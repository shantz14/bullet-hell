.PHONY: build web server run dev

build: web server

web:
	cd web && npm install && npm run build

server:
	go build -o bullet-hell ./cmd/server

run: build
	./bullet-hell

# Run `go run ./cmd/server` in one terminal and this in another for hot reload.
dev:
	cd web && npm run dev
