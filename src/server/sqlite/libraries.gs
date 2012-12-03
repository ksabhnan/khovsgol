[indent=4]

uses
    Sqlite
    SqliteUtil

namespace Khovsgol._Sqlite

    class Libraries: Khovsgol.Libraries
        def override initialize() raises GLib.Error
            if _db is not null
                return
            
            var file = "%s/.khovsgol/khovsgol.db".printf(Environment.get_home_dir())
            _db = new SqliteUtil.Database(file)
            
            // Track table
            _db.execute("CREATE TABLE IF NOT EXISTS track (path TEXT PRIMARY KEY, library TEXT, title TEXT COLLATE NOCASE, title_sort TEXT, artist TEXT COLLATE NOCASE, artist_sort TEXT, album TEXT COLLATE NOCASE, album_sort TEXT, position INTEGER, duration REAL, date INTEGER, type TEXT)")
            _db.execute("CREATE INDEX IF NOT EXISTS track_library_idx ON track (library)")
            _db.execute("CREATE INDEX IF NOT EXISTS track_title_idx ON track (title)")
            _db.execute("CREATE INDEX IF NOT EXISTS track_title_sort_idx ON track (title_sort)")
            _db.execute("CREATE INDEX IF NOT EXISTS track_artist_idx ON track (artist)")
            _db.execute("CREATE INDEX IF NOT EXISTS track_artist_sort_idx ON track (artist_sort)")
            _db.execute("CREATE INDEX IF NOT EXISTS track_album_sort_idx ON track (album_sort)")
            _db.execute("CREATE INDEX IF NOT EXISTS track_date_idx ON track (date)")
            _db.execute("CREATE INDEX IF NOT EXISTS track_type_idx ON track (type)")

            // Track pointers table
            _db.execute("CREATE TABLE IF NOT EXISTS track_pointer (path TEXT, position INTEGER, album TEXT)")
            _db.execute("CREATE INDEX IF NOT EXISTS track_pointer_position_idx ON track_pointer (position)")
            _db.execute("CREATE INDEX IF NOT EXISTS track_pointer_album_idx ON track_pointer (album)")

            // Album table
            _db.execute("CREATE TABLE IF NOT EXISTS album (path TEXT PRIMARY KEY, library TEXT, title TEXT COLLATE NOCASE, title_sort TEXT, artist TEXT COLLATE NOCASE, artist_sort TEXT, date INTEGER(8), compilation INTEGER(1), type TEXT)")
            _db.execute("CREATE INDEX IF NOT EXISTS album_library_idx ON album (library)")
            _db.execute("CREATE INDEX IF NOT EXISTS album_title_idx ON album (title)")
            _db.execute("CREATE INDEX IF NOT EXISTS album_title_sort_idx ON album (title_sort)")
            _db.execute("CREATE INDEX IF NOT EXISTS album_artist_idx ON album (artist)")
            _db.execute("CREATE INDEX IF NOT EXISTS album_artist_sort_idx ON album (artist_sort)")
            _db.execute("CREATE INDEX IF NOT EXISTS album_date_idx ON album (date)")
            _db.execute("CREATE INDEX IF NOT EXISTS album_compilation_idx ON album (compilation)")
            _db.execute("CREATE INDEX IF NOT EXISTS album_type_idx ON album (type)")

            // Scanned table
            _db.execute("CREATE TABLE IF NOT EXISTS scanned (path TEXT PRIMARY KEY, timestamp INTEGER(8))")
            
        def override begin() raises GLib.Error
            _lock.lock()
            _db.execute("BEGIN")

        def override commit() raises GLib.Error
            try
                _db.execute("COMMIT")
            finally
                _lock.unlock()

        def override rollback() raises GLib.Error
            try
                _db.execute("ROLLBACK")
            finally
                _lock.unlock()
            
        //
        // Tracks
        //
        
        def override get_track(path: string): Track? raises GLib.Error
            if _get_track is null
                _db.prepare(out _get_track, "SELECT library, title, title_sort, artist, artist_sort, album, album_sort, position, duration, date, type FROM track WHERE path=?")
            else
                _get_track.reset()
            _get_track.bind_text(1, path)
            if _get_track.step() == ROW
                var track = new Track()
                track.path = path
                track.library = _get_track.column_text(0)
                track.title = _get_track.column_text(1)
                track.title_sort = _get_track.column_text(2)
                track.artist = _get_track.column_text(3)
                track.artist_sort = _get_track.column_text(4)
                track.album = _get_track.column_text(5)
                track.album_sort = _get_track.column_text(6)
                track.position = _get_track.column_int(7)
                track.duration = _get_track.column_double(8)
                track.date = _get_track.column_int(9)
                track.file_type = _get_track.column_text(10)
                return track
            return null
        
        def override save_track(track: Track) raises GLib.Error
            if _save_track is null
                _db.prepare(out _save_track, "INSERT OR REPLACE INTO track (path, library, title, title_sort, artist, artist_sort, album, album_sort, position, duration, date, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            else
                _save_track.reset()
            _save_track.bind_text(1, track.path)
            _save_track.bind_text(2, track.library)
            _save_track.bind_text(3, track.title)
            _save_track.bind_text(4, track.title_sort)
            _save_track.bind_text(5, track.artist)
            _save_track.bind_text(6, track.artist_sort)
            _save_track.bind_text(7, track.album)
            _save_track.bind_text(8, track.album_sort)
            _save_track.bind_int(9, track.position)
            _save_track.bind_double(10, track.duration)
            _save_track.bind_int(11, (int) track.date)
            _save_track.bind_text(12, track.file_type)
            _db.assert_done(_save_track.step())

        def override delete_track(path: string) raises GLib.Error
            if _delete_track1 is null
                _db.prepare(out _delete_track1, "DELETE FROM track WHERE path=?")
            else
                _delete_track1.reset()
            _delete_track1.bind_text(1, path)
            _db.assert_done(_delete_track1.step())

            // Delete track pointers
            // TODO: move positions in custom compilation?
            if _delete_track2 is null
                _db.prepare(out _delete_track2, "DELETE FROM track_pointer WHERE path=?")
            else
                _delete_track2.reset()
            _delete_track2.bind_text(1, path)
            _db.assert_done(_delete_track2.step())
            
        //
        // Track pointers
        //
        
        def override get_track_pointer(album: string, position: int): TrackPointer? raises GLib.Error
            if _get_track_pointer is null
                _db.prepare(out _get_track_pointer, "SELECT path FROM track_pointer WHERE album=? AND position=?")
            else
                _get_track_pointer.reset()
            _get_track_pointer.bind_text(1, album)
            _get_track_pointer.bind_int(2, position)
            if _get_track_pointer.step() == ROW
                var track_pointer = new TrackPointer()
                track_pointer.path = _get_track_pointer.column_text(0)
                track_pointer.position = position
                track_pointer.album = album
                return track_pointer
            return null

        def override save_track_pointer(track_pointer: TrackPointer) raises GLib.Error
            if _save_track_pointer is null
                _db.prepare(out _save_track_pointer, "INSERT OR REPLACE INTO track_pointer (path, position, album) VALUES (?, ?, ?)")
            else
                _save_track_pointer.reset()
            _save_track_pointer.bind_text(1, track_pointer.path)
            _save_track_pointer.bind_int(2, track_pointer.position)
            _save_track_pointer.bind_text(3, track_pointer.album)
            _db.assert_done(_save_track_pointer.step())

        def override delete_track_pointer(album: string, position: int) raises GLib.Error
            // TODO: renumber the rest of the pointers?
            if _delete_track_pointer is null
                _db.prepare(out _delete_track_pointer, "DELETE FROM track_pointer WHERE album=? AND position=?")
            else
                _delete_track_pointer.reset()
            _delete_track_pointer.bind_text(1, album)
            _delete_track_pointer.bind_int(2, position)
            _db.assert_done(_delete_track_pointer.step())

        def override delete_track_pointers(album: string) raises GLib.Error
            if _delete_track_pointers is null
                _db.prepare(out _delete_track_pointers, "DELETE FROM track_pointer WHERE album=?")
            else
                _delete_track_pointers.reset()
            _delete_track_pointers.bind_text(1, album)
            _db.assert_done(_delete_track_pointers.step())

        def override move_track_pointers(album: string, delta: int, from_position: int = int.MIN) raises GLib.Error
            if from_position == int.MIN
                if _move_track_pointers1 is null
                    _db.prepare(out _move_track_pointers1, "UPDATE track_pointer SET position=position+? WHERE album=?")
                else
                    _move_track_pointers1.reset()
                _move_track_pointers1.bind_int(1, delta)
                _move_track_pointers1.bind_text(2, album)
                _db.assert_done(_move_track_pointers1.step())
            else
                if _move_track_pointers2 is null
                    _db.prepare(out _move_track_pointers2, "UPDATE track_pointer SET position=position+? WHERE album=? AND position>=?")
                else
                    _move_track_pointers2.reset()
                _move_track_pointers2.bind_int(1, delta)
                _move_track_pointers2.bind_text(2, album)
                _move_track_pointers2.bind_int(3, from_position)
                _db.assert_done(_move_track_pointers2.step())

        //
        // Albums
        //
        
        def override get_album(path: string): Album? raises GLib.Error
            if _get_album is null
                _db.prepare(out _get_album, "SELECT library, title, title_sort, artist, artist_sort, date, compilation, type FROM album WHERE path=?")
            else
                _get_album.reset()
            _get_album.bind_text(1, path)
            if _get_album.step() == ROW
                var album = new Album()
                album.path = path
                album.library = _get_album.column_text(0)
                album.title = _get_album.column_text(1)
                album.title_sort = _get_album.column_text(2)
                album.artist = _get_album.column_text(3)
                album.artist_sort = _get_album.column_text(4)
                album.date = _get_album.column_int64(5)
                album.compilation_type = (CompilationType) _get_album.column_int(6)
                album.file_type = _get_album.column_text(7)
                return album
            return null
        
        def override save_album(album: Album) raises GLib.Error
            if _save_album is null
                _db.prepare(out _save_album, "INSERT OR REPLACE INTO album (path, library, title, title_sort, artist, artist_sort, date, compilation, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            else
                _save_album.reset()
            _save_album.bind_text(1, album.path)
            _save_album.bind_text(2, album.library)
            _save_album.bind_text(3, album.title)
            _save_album.bind_text(4, album.title_sort)
            _save_album.bind_text(5, album.artist)
            _save_album.bind_text(6, album.artist_sort)
            _save_album.bind_int64(7, (int64) album.date)
            _save_album.bind_int(8, album.compilation_type)
            _save_album.bind_text(9, album.file_type)
            _db.assert_done(_save_album.step())

        def override delete_album(path: string) raises GLib.Error
            // Delete track pointers
            if _delete_album1 is null
                _db.prepare(out _delete_album1, "DELETE FROM track_pointer WHERE album=? OR path LIKE ? ESCAPE \"\\\"")
            else
                _delete_album1.reset()
            _delete_album1.bind_text(1, path)
            _delete_album1.bind_text(2, escape_like(path + SEPARATOR) + "%")
            _db.assert_done(_delete_album1.step())

            // Delete tracks
            if _delete_album2 is null
                _db.prepare(out _delete_album2, "DELETE FROM track WHERE path LIKE ? ESCAPE \"\\\"")
            else
                _delete_album2.reset()
            _delete_album2.bind_text(1, escape_like(path + SEPARATOR) + "%")
            _db.assert_done(_delete_album2.step())

            // Delete album
            if _delete_album3 is null
                _db.prepare(out _delete_album3, "DELETE FROM album WHERE path=?")
            else
                _delete_album3.reset()
            _delete_album3.bind_text(1, path)
            _db.assert_done(_delete_album3.step())
        
        //
        // Iterate tracks
        //
        
        def override iterate_tracks(args: IterateTracksArgs): IterableOfTrack raises GLib.Error
            var q = new Query()
            q.table = "track"
            q.add_fields("path", "library", "title", "title_sort", "artist", "artist_sort", "album", "album_sort", "position", "duration", "date", "type")
            q.sort.add_all(args.sort)
            parse_libraries(q, "", args.libraries)

            // All the LIKE requirements are OR-ed
            var likes = new list of string
            if args.title_like is not null
                likes.add("title LIKE ? ESCAPE \"\\\"")
                q.bindings.add(args.title_like)
            if args.artist_like is not null
                likes.add("artist LIKE ? ESCAPE \"\\\"")
                q.bindings.add(args.artist_like)
            if args.album_like is not null
                likes.add("album LIKE ? ESCAPE \"\\\"")
                q.bindings.add(args.album_like)
            if !likes.is_empty
                q.requirements.add("(" + join(" OR ", likes) + ")")

            return new SqlTracks(q.execute(_db))

        def override iterate_tracks_in_album(args: IterateForAlbumArgs): IterableOfTrack raises GLib.Error
            var q = new Query()
            q.table = "track"
            q.add_fields("path", "library", "title", "title_sort", "artist", "artist_sort", "album", "album_sort", "position", "duration", "date", "type")
            q.sort.add_all(args.sort)
            q.requirements.add("path LIKE ? ESCAPE \"\\\"")
            q.bindings.add(escape_like(args.album + SEPARATOR) + "%")

            return new SqlTracks(q.execute(_db))
        
        def override iterate_tracks_by_artist(args: IterateForArtistArgs): IterableOfTrack raises GLib.Error
            var q = new Query()
            q.table = "track"
            q.sort.add_all(args.sort)
            parse_libraries(q, "", args.libraries)
                
            if args.like
                q.add_fields("path", "library", "title", "title_sort", "artist", "artist_sort", "album", "album_sort", "position", "duration", "date", "type")
                q.requirements.add("artist LIKE ? ESCAPE \"\\\"")
            else
                // Optimized handling using a constant in case of strict equality
                q.add_fields("path", "library", "title", "title_sort", "artist_sort", "album", "album_sort", "position", "duration", "date", "type")
                q.requirements.add("artist=?")
                q.constants["artist"] = args.artist
            q.bindings.add(args.artist)

            return new SqlTracks(q.execute(_db))
        
        def override iterate_track_paths(path: string): IterableOfString raises GLib.Error
            var q = new Query()
            q.table = "track"
            q.fields.add("path")
            q.requirements.add("path LIKE ? ESCAPE \"\\\"")
            q.bindings.add(escape_like(path + SEPARATOR) + "%")
            return new SqlStrings(q.execute(_db), "path")
        
        //
        // Iterate track pointers
        //
        
        def override iterate_raw_track_pointers_in_album(args: IterateForAlbumArgs): IterableOfTrackPointer raises GLib.Error
            var q = new Query()
            q.table = "track_pointer"
            q.add_fields("path", "position")
            q.sort.add_all(args.sort)
            q.requirements.add("album=?")
            q.bindings.add(args.album)
            q.constants["album"] = args.album
            return new SqlTrackPointers(q.execute(_db))

        def override iterate_track_pointers_in_album(args: IterateForAlbumArgs): IterableOfTrack raises GLib.Error
            var q = new Query()
            q.table = "track_pointer LEFT JOIN track ON track_pointer.path=track.path INNER JOIN album ON track_pointer.album=album.path"
            q.add_fields("track.path", "track.library", "track.title", "track.title_sort", "track.artist", "track.artist_sort", "album.title AS album", "album.title_sort AS album_sort", "track_pointer.position", "track.duration", "track.date", "track.type")
            q.requirements.add("track_pointer.album=?")
            q.bindings.add(args.album)
            
            // Fix sort
            var fixed_sort = new list of string
            for s in args.sort
                if s == "position"
                    s = "track_pointer.position"
                else if s == "album"
                    s = "track_pointer.album"
                fixed_sort.add(s)
            q.sort.add_all(fixed_sort)
            
            return new SqlTracks(q.execute(_db))

        def override iterate_track_pointers(args: IterateTracksArgs): IterableOfTrack raises GLib.Error
            var q = new Query()
            q.table = "track_pointer LEFT JOIN track ON track_pointer.path=track.path INNER JOIN album ON track_pointer.album=album.path"
            q.add_fields("track.path", "track.library", "track.title", "track.title_sort", "track.artist", "track.artist_sort", "album.title AS album", "album.title_sort AS album_sort", "track_pointer.position", "track.duration", "track.date", "track.type", "track_pointer.album AS album_path")
            q.sort.add_all(args.sort)
            parse_libraries(q, "track.", args.libraries)

            // All the LIKE requirements are OR-ed
            var likes = new list of string
            if args.title_like is not null
                likes.add("track.title LIKE ? ESCAPE \"\\\"")
                q.bindings.add(args.title_like)
            if args.artist_like is not null
                likes.add("track.artist LIKE ? ESCAPE \"\\\"")
                q.bindings.add(args.artist_like)
            if args.album_like is not null
                likes.add("track_pointer.album LIKE ? ESCAPE \"\\\"")
                q.bindings.add(args.album_like)
            if !likes.is_empty
                q.requirements.add("(" + join(" OR ", likes) + ")")

            // Fix sort
            var fixed_sort = new list of string
            for s in args.sort
                if s == "position"
                    s = "track_pointer.position"
                else
                    s = "track." + s
                fixed_sort.add(s)
            q.sort.add_all(fixed_sort)

            return new SqlTracks(q.execute(_db), true)
        
        //
        // Iterate albums
        //
        
        def override iterate_albums(args: IterateAlbumsArgs): IterableOfAlbum raises GLib.Error
            var q = new Query()
            q.table = "album"
            q.add_fields("path", "library", "title", "title_sort", "artist", "artist_sort", "date", "compilation", "type")
            q.sort.add_all(args.sort)
            parse_libraries(q, "", args.libraries)
            
            // Compilation type
            if args.compilation_type != CompilationType.ANY
                q.requirements.add("compilation=?")
                q.bindings.add((int) args.compilation_type)
                
            return new SqlAlbums(q.execute(_db))

        def override iterate_album_paths(path: string): IterableOfString raises GLib.Error
            var q = new Query()
            q.table = "album"
            q.fields.add("path")
            q.requirements.add("path LIKE ? ESCAPE \"\\\"")
            q.bindings.add(escape_like(path + SEPARATOR) + "%")
            return new SqlStrings(q.execute(_db), "path")
        
        def override iterate_albums_with_artist(args: IterateForArtistArgs): IterableOfAlbum raises GLib.Error
            var q = new Query()
            q.table = "album INNER JOIN track ON album.title=track.album"
            q.add_fields("album.path", "album.library", "album.title", "album.title_sort", "album.artist", "album.artist_sort", "album.date", "album.compilation", "album.type")
            q.sort.add_all(args.sort)
            q.constraint = "DISTINCT"
            parse_libraries(q, "album.", args.libraries)
            
            if args.like
                q.requirements.add("track.artist LIKE ? ESCAPE \"\\\"")
            else
                q.requirements.add("track.artist=?")
            q.bindings.add(args.artist)

            return new SqlAlbums(q.execute(_db))

        def override iterate_albums_by_artist(args: IterateForArtistArgs): IterableOfAlbum raises GLib.Error
            var q = new Query()
            q.table = "album"
            q.sort.add_all(args.sort)
            parse_libraries(q, "", args.libraries)
            
            if args.like
                q.add_fields("path", "library", "title", "title_sort", "artist", "artist_sort", "date", "compilation", "type")
                q.requirements.add("artist LIKE ? ESCAPE \"\\\"")
            else
                // Optimized handling using a constant in case of strict equality
                q.add_fields("path", "library", "title", "title_sort", "artist_sort", "date", "compilation", "type")
                q.requirements.add("artist=?")
                q.constants["artist"] = args.artist
            q.bindings.add(args.artist)
            
            return new SqlAlbums(q.execute(_db))
        
        def override iterate_albums_at(args: IterateForDateArgs): IterableOfAlbum raises GLib.Error
            var q = new Query()
            q.table = "album"
            q.sort.add_all(args.sort)
            parse_libraries(q, "", args.libraries)
            
            if args.like
                q.add_fields("path", "library", "title", "title_sort", "artist", "artist_sort", "date", "compilation", "type")
                q.requirements.add("date LIKE ? ESCAPE \"\\\"")
            else
                // Optimized handling using a constant in case of strict equality
                q.add_fields("path", "library", "title", "title_sort", "artist", "artist_sort", "compilation", "type")
                q.requirements.add("date=?")
                q.constants["date"] = args.date.to_string()
            q.bindings.add(args.date.to_string())

            return new SqlAlbums(q.execute(_db))
        
        //
        // Iterate artists
        //
        
        def override iterate_artists(args: IterateByAlbumsOrTracksArgs): IterableOfArtist raises GLib.Error
            var q = new Query()
            q.table = args.album_artist ? "album" : "track"
            q.add_fields("artist", "artist_sort")
            q.sort.add_all(args.sort)
            q.requirements.add("artist IS NOT NULL")
            q.constraint = "DISTINCT"
            parse_libraries(q, "", args.libraries)

            return new SqlArtists(q.execute(_db))
            
        //
        // Iterate dates
        //
        
        def override iterate_dates(args: IterateByAlbumsOrTracksArgs): IterableOfInt raises GLib.Error
            var q = new Query()
            q.table = args.album_artist ? "album" : "track"
            q.add_fields("date")
            q.sort.add_all(args.sort)
            q.requirements.add("date IS NOT NULL")
            q.constraint = "DISTINCT"
            parse_libraries(q, "", args.libraries)

            return new SqlInts(q.execute(_db), "date")
            
        //
        // Timestamps
        //
        
        def override get_timestamp(path: string): int64 raises GLib.Error
            if _get_timestamp is null
                _db.prepare(out _get_timestamp, "SELECT timestamp FROM scanned WHERE path=?")
            else
                _get_timestamp.reset()
            _get_timestamp.bind_text(1, path)
            if _get_timestamp.step() == ROW
                return _get_timestamp.column_int64(0)
            return int64.MIN

        def override set_timestamp(path: string, timestamp: int64) raises GLib.Error
            if _set_timestamp is null
                _db.prepare(out _set_timestamp, "INSERT OR REPLACE INTO scanned (path, timestamp) VALUES (?, ?)")
            else
                _set_timestamp.reset()
            _set_timestamp.bind_text(1, path)
            _set_timestamp.bind_int64(2, timestamp)
            _db.assert_done(_set_timestamp.step())

        _db: SqliteUtil.Database
        _lock: GLib.Mutex = GLib.Mutex()
        _get_track: Statement
        _save_track: Statement
        _delete_track1: Statement
        _delete_track2: Statement
        _get_track_pointer: Statement
        _save_track_pointer: Statement
        _delete_track_pointer: Statement
        _delete_track_pointers: Statement
        _move_track_pointers1: Statement
        _move_track_pointers2: Statement
        _get_album: Statement
        _save_album: Statement
        _delete_album1: Statement
        _delete_album2: Statement
        _delete_album3: Statement
        _get_timestamp: Statement
        _set_timestamp: Statement
