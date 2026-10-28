# v0.6.5 distribution and qualification

The Safe Demo ZIP is a static frontend with a loopback preview script; extract it and run `node scripts/preview-static.mjs --root public --port 0` with a compatible installed Node runtime. Ctrl+C stops that host. No IRIS or AI service is required.

The Core source ZIP contains source, not a qualified built Core ZIP. Docker and IPM were separately qualified locally against frozen source f55623f6. The IPM browser witness used an authenticated loopback harness; ordinary interactive sign-in was not independently qualified. An installer, Open Exchange update and a distributable live IRIS adapter have no v0.6.5 qualification implied here. Check the release's external artifact identities before distribution.
