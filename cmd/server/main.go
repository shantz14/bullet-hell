package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"

	"github.com/shantz14/bullet-hell/internal/store"
)

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	dbPath := flag.String("db", "bullet-hell.db", "sqlite database path")
	static := flag.String("static", "web/dist", "directory of built frontend assets")
	flag.Parse()

	st, err := store.Open(*dbPath)
	if err != nil {
		log.Fatalf("open store: %v", err)
	}
	defer st.Close()

	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/bosses", func(w http.ResponseWriter, r *http.Request) {
		bosses, err := st.Bosses()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, bosses)
	})

	mux.HandleFunc("GET /api/runs", func(w http.ResponseWriter, r *http.Request) {
		runs, err := st.RecentRuns(20)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, runs)
	})

	mux.HandleFunc("POST /api/runs", func(w http.ResponseWriter, r *http.Request) {
		var run store.Run
		if err := json.NewDecoder(r.Body).Decode(&run); err != nil {
			http.Error(w, "invalid run payload", http.StatusBadRequest)
			return
		}
		id, err := st.RecordRun(run)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]int64{"id": id})
	})

	mux.Handle("/", http.FileServer(http.Dir(*static)))

	log.Printf("listening on %s", *addr)
	log.Fatal(http.ListenAndServe(*addr, mux))
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("write json: %v", err)
	}
}
