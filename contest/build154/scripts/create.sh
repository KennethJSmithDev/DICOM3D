#!/bin/sh
# WHY: this exact EAP image's bootstrap expects a second vendor-utility path.
# BOUNDARY: guard the vendor bytes; retain the original executable and health checks.
set -eu
umask 077
test "$(sha256sum /usr/irissys/csp/bin/CSPpwd | cut -d ' ' -f 1)" = fd3fd2918b31d5f896547685be68133e8c133a8d4552f80c3301a53c5b00a4cd
if [ ! -e /usr/irissys/bin/CSPpwd ]; then
  ln -s ../csp/bin/CSPpwd /usr/irissys/bin/CSPpwd
fi
test "$(readlink -f /usr/irissys/bin/CSPpwd)" = /usr/irissys/csp/bin/CSPpwd
mkdir -p /home/irisowner/contest-private
cp /run/contest/bootstrap.txt /home/irisowner/contest-private/bootstrap-password.txt
chmod 600 /home/irisowner/contest-private/bootstrap-password.txt
