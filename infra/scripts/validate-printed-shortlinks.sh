#!/bin/sh
set -eu

caddyfile=${1:-caddy/Caddyfile}

awk '
	/^y4h\.org, www\.y4h\.org \{$/ { in_site = 1; found_site = 1; next }
	/^admin\.y4h\.org \{$/ { in_site = 0 }
	in_site && /^[[:space:]]*@shortlink path \/signup \/training \/campus-training \/sign-in \/join \/whatsapp \/donate$/ {
		found_matcher = 1
	}
	in_site && /^[[:space:]]*handle @shortlink \{$/ {
		getline
		if ($0 ~ /^[[:space:]]*reverse_proxy shlink:8080$/) {
			found_proxy = 1
		}
	}
	END {
		if (!found_site || !found_matcher || !found_proxy) {
			print "The y4h.org printed-QR matcher must contain all seven protected paths and proxy them to Shlink." > "/dev/stderr"
			exit 1
		}
	}
' "$caddyfile"
