npm install

(foreman start | tail -f)&
BGPID=$!

while inotifywait -r ./lib; do
	kill $BGPID
	(foreman start | tail -f)&
	BGPID=$!
	sleep 1
done