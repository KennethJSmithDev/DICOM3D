"""Read and hash staged Git blobs without retaining whole assets in Python."""
import hashlib
import os
import subprocess
from pathlib import Path


class StagedBlobReader:
    def __init__(self, root):
        self.root = Path(root)
        def git_path(name):
            value = subprocess.check_output(['git', 'rev-parse', '--git-path', name], cwd=self.root).decode().rstrip('\r\n')
            return self.root / value
        self.index = git_path('index')
        self.replace_refs = git_path('refs/replace')
        self.packed_refs = git_path('packed-refs')
        try:
            ref_format = subprocess.check_output(['git', 'rev-parse', '--show-ref-format'], cwd=self.root,
                                                 stderr=subprocess.DEVNULL).decode().strip()
        except subprocess.CalledProcessError:
            ref_format = 'unknown'
        # Unknown reference stores and custom replacement namespaces retain the
        # original per-file lookup; their invalidation boundaries are not known.
        self.legacy_only = ref_format != 'files' or 'GIT_REPLACE_REF_BASE' in os.environ
        self.process = None
        self.stamp = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        self.close(abort=exc_type is not None)

    @staticmethod
    def _path_stamp(path):
        try:
            s = path.stat()
        except FileNotFoundError:
            return None
        except OSError:
            # Unknown identity must use the original per-file lookup.
            return (0, 0, 0, 0, 0)
        return (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns)

    def _lookup_stamp(self):
        return (self._path_stamp(self.index), self._path_stamp(self.replace_refs),
                self._path_stamp(self.packed_refs))

    def close(self, abort=False):
        if self.process is None:
            return
        p, self.process = self.process, None
        if abort and p.poll() is None:
            p.terminate()
        broken_pipe = False
        try:
            p.stdin.close()
        except BrokenPipeError:
            broken_pipe = True
        try:
            code = p.wait(timeout=10)
        except subprocess.TimeoutExpired:
            p.kill()
            p.wait()
            raise
        finally:
            p.stdout.close()
        if (code != 0 or broken_pipe) and not abort:
            raise subprocess.CalledProcessError(code or 1, p.args)

    def _legacy(self, name):
        data = subprocess.check_output(['git', 'show', ':' + name], cwd=self.root)
        return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

    def digest(self, name):
        # Newlines cannot be expressed in the portable batch protocol. Loose
        # replacement refs can change without altering the staged index.
        if self.legacy_only or self.replace_refs.exists() or '\n' in name or '\r' in name:
            self.close()
            return self._legacy(name)
        before = self._lookup_stamp()
        # Without an identity for an existing index/ref file, a replacement may
        # be indistinguishable from the cached Git process's view.
        if any(stamp is not None and not stamp[1] for stamp in before):
            self.close()
            return self._legacy(name)
        if self.process is None or before != self.stamp:
            self.close()
            self.process = subprocess.Popen(['git', 'cat-file', '--batch'], cwd=self.root,
                                            stdin=subprocess.PIPE, stdout=subprocess.PIPE)
            self.stamp = before
        p = self.process
        p.stdin.write((':' + name + '\n').encode())
        p.stdin.flush()
        header = p.stdout.readline()
        parts = header.rstrip(b'\n').split(b' ')
        if len(parts) == 3 and parts[1] == b'blob' and parts[2].isdigit():
            size = remaining = int(parts[2])
            digest = hashlib.sha256()
            while remaining:
                data = p.stdout.read(min(remaining, 1024 * 1024))
                if not data:
                    raise EOFError('Unexpected end of staged Git object')
                digest.update(data)
                remaining -= len(data)
            if p.stdout.read(1) != b'\n':
                raise ValueError('Invalid staged Git object delimiter')
            result = {'bytes': size, 'sha256': digest.hexdigest()}
        else:
            result = None
        if self._lookup_stamp() != before:
            # Index or packed/loose replacement refs changed during this read.
            # Use the original fresh-process lookup for this object.
            self.close()
            return self._legacy(name)
        if result is None:
            raise subprocess.CalledProcessError(128, ['git', 'show', ':' + name])
        return result
