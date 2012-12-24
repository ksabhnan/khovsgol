[indent=4]

namespace Khovsgol.Client

    class Configuration: Object implements Khovsgol.Configuration
        construct() raises KeyFileError
            _file = "%s/.khovsgol/client.conf".printf(Environment.get_home_dir())
            _key_file = new KeyFile()
            try
                _key_file.load_from_file(_file, KeyFileFlags.KEEP_COMMENTS)
            except e: FileError
                _logger.message(e.message)
        
        prop x: int
            get
                try
                    return _key_file.get_integer("ui", "x")
                except e: KeyFileError
                    return int.MIN
            set
                _key_file.set_integer("ui", "x", value)
        
        prop y: int
            get
                try
                    return _key_file.get_integer("ui", "y")
                except e: KeyFileError
                    return int.MIN
            set
                _key_file.set_integer("ui", "y", value)
        
        prop width: int
            get
                try
                    return _key_file.get_integer("ui", "width")
                except e: KeyFileError
                    return int.MIN
            set
                _key_file.set_integer("ui", "width", value)
        
        prop height: int
            get
                try
                    return _key_file.get_integer("ui", "height")
                except e: KeyFileError
                    return int.MIN
            set
                _key_file.set_integer("ui", "height", value)

        prop split: int
            get
                try
                    return _key_file.get_integer("ui", "split")
                except e: KeyFileError
                    return int.MIN
            set
                _key_file.set_integer("ui", "split", value)

        prop playlist_style: string
            owned get
                try
                    return _key_file.get_string("ui", "playlist-style")
                except e: KeyFileError
                    return "group_by_albums"
            set
                _key_file.set_string("ui", "playlist-style", value)

        prop library_style: string
            owned get
                try
                    return _key_file.get_string("ui", "library-style")
                except e: KeyFileError
                    return "artists_albums"
            set
                _key_file.set_string("ui", "library-style", value)

        prop show_duration: bool
            get
                try
                    return _key_file.get_boolean("ui", "show-duration")
                except e: KeyFileError
                    return true
            set
                _key_file.set_boolean("ui", "show-duration", value)
                show_duration_change(value)

        event show_duration_change(value: bool)

        prop subdue_lossy: bool
            get
                try
                    return _key_file.get_boolean("ui", "subdue-lossy")
                except e: KeyFileError
                    return false
            set
                _key_file.set_boolean("ui", "subdue-lossy", value)
                subdue_lossy_change(value)
        
        event subdue_lossy_change(value: bool)
        
        prop expand_on_click: bool
            get
                try
                    return _key_file.get_boolean("ui", "expand-on-click")
                except e: KeyFileError
                    return false
            set
                _key_file.set_boolean("ui", "expand-on-click", value)
                expand_on_click_change(value)

        event expand_on_click_change(value: bool)
        
        prop focus_on_library: bool
            get
                try
                    return _key_file.get_boolean("ui", "focus-on-library")
                except e: KeyFileError
                    return false
            set
                _key_file.set_boolean("ui", "focus-on-library", value)
        
        prop scrobbling_service: string?
            owned get
                try
                    return _key_file.get_string("scrobbling", "service")
                except e: KeyFileError
                    return "last.fm"
            set
                if (value is not null) and (value.length > 0)
                    _key_file.set_string("scrobbling", "service", value)
                else
                    try
                        _key_file.remove_key("scrobbling", "service")
                    except e: KeyFileError
                        pass

        prop scrobbling_username: string?
            owned get
                try
                    return _key_file.get_string("scrobbling", "username")
                except e: KeyFileError
                    return null
            set
                if (value is not null) and (value.length > 0)
                    _key_file.set_string("scrobbling", "username", value)
                else
                    try
                        _key_file.remove_key("scrobbling", "username")
                    except e: KeyFileError
                        pass

        prop scrobbling_password: string?
            owned get
                try
                    return _key_file.get_string("scrobbling", "password")
                except e: KeyFileError
                    return null
            set
                if (value is not null) and (value.length > 0)
                    _key_file.set_string("scrobbling", "password", value)
                else
                    try
                        _key_file.remove_key("scrobbling", "password")
                    except e: KeyFileError
                        pass

        def is_feature_active(name: string): bool
            try
                return _key_file.get_boolean("features", name)
            except e: KeyFileError
                return name != "music-indicator"

        def set_feature_active(name: string, value: bool)
            _key_file.set_boolean("features", name, value)

        def is_feature_boolean(name: string, property: string): bool
            try
                return _key_file.get_boolean("feature." + name, property)
            except e: KeyFileError
                if property == "autostart"
                    return true
                else
                    return false

        def set_feature_boolean(name: string, property: string, value: bool)
            _key_file.set_boolean("feature." + name, property, value)

        /*
         * Saves the configuration.
         */
        def save(): bool
            var data = _key_file.to_data()
            try
                return FileUtils.set_data(_file, data.data)
            except e: GLib.FileError
                _logger.exception(e)
                return false
    
        _file: string
        _key_file: KeyFile
        
        _logger: static Logging.Logger

        init
            _logger = Logging.get_logger("khovsgol.configuration")
