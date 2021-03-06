[indent=4]

uses
    JsonUtil
    DBusUtil

namespace Khovsgol.Client.Features

    /*
     * MPRIS2 feature.
     * 
     * Allows controlling of the client over DBus using the MPRIS2
     * protocol, often used for for integration with desktop
     * environments. This plugin is designed to work well with the
     * Ubuntu sound indicator.
     * 
     * Adds a "/org/mpris/MediaPlayer2" DBus object to our bus.
     * 
     * The Ubuntu sound indicator will automatically create an entry
     * for us when it first discovers us, which will persist even when
     * we are not running.
     * 
     * See:
     *  http://www.freedesktop.org/wiki/Specifications/mpris-spec/metadata
     */
    class Mpris2Feature: Object implements Feature
        prop readonly name: string = "mpris2"
        prop readonly label: string = "Sound indicator integration"
        prop readonly persistent: bool = true
        prop readonly state: FeatureState
            get
                return (FeatureState) AtomicInt.@get(ref _state)

        prop instance: Instance
        
        def start()
            if state == FeatureState.STOPPED
                set_state(FeatureState.STARTING)
                
                _object = new Mpris2(_instance)
                _player = new Mpris2Player(_instance, _connector)
                _connector.connect.connect(on_connected)
                _connector.disconnecting.connect(on_disconnecting)
                
                // Our bus name must start with "org.mpris.MediaPlayer2." for clients to auto-discover us.
                // The suffix does not matter (DesktopEntry is used for the name).
                if not _connector.start("org.mpris.MediaPlayer2.khovsgol")
                    _logger.warning("Could not own name on DBus")
                    _connector.connect.disconnect(on_connected)
                    _connector.disconnecting.disconnect(on_disconnecting)
                    _object = null
                    _player = null
                    set_state(FeatureState.STOPPED)
        
        def stop()
            if state == FeatureState.STARTED
                set_state(FeatureState.STOPPING)
                _connector.stop()
        
        def remove_from_sound_indicator()
            // The sound indicator must be restarted for new settings to take effect.
            // To do it manually:
            //
            //  killall indicator-sound-service
            //
            // To remove all entries manually:
            //
            //  gsettings set com.canonical.indicator.sound interested-media-players "[]"
        
            var settings = new Settings("com.canonical.indicator.sound")
            var interested_media_players = settings.get_strv("interested-media-players")
            for var interested_media_player in interested_media_players
                if interested_media_player == "khovsgol"
                    var new_interested_media_players = new array of string[interested_media_player.length - 1]
                    var i = 0
                    var found = false
                    for var e in interested_media_players
                        if not found and (e == "khovsgol")
                            found = true
                            continue
                        new_interested_media_players[i++] = e
                    settings.set_strv("interested-media-players", new_interested_media_players)
                    settings.apply()
                    _logger.message("Removed from sound indicator")
                    return
        
        _state: int = FeatureState.STOPPED
        _connector: Connector = new Connector()
        _object: Mpris2?
        _object_id: uint
        _player: Mpris2Player?
        _player_id: uint
        
        def private set_state(state: FeatureState)
            AtomicInt.@set(ref _state, state)
            _logger.message(get_name_from_feature_state(state))
            state_change(state)

        def private on_connected(connection: DBusConnection)
            // Register a MediaPlayer2 object with several interfaces
            try
                _object_id = connection.register_object("/org/mpris/MediaPlayer2", _object)
                _player_id = connection.register_object("/org/mpris/MediaPlayer2", _player)
            except e: IOError
                _logger.exception(e)
            set_state(FeatureState.STARTED)
        
        def private on_disconnecting(connection: DBusConnection)
            _connector.connect.disconnect(on_connected)
            _connector.disconnecting.disconnect(on_disconnecting)
            if _object_id != 0
                connection.unregister_object(_object_id)
                _object_id = 0
            if _player_id != 0
                connection.unregister_object(_player_id)
                _player_id = 0
            _object = null
            _player = null
            set_state(FeatureState.STOPPED)
        
        _logger: static Logging.Logger
        
        init
            _logger = Logging.get_logger("khovsgol.mpris2")

        [DBus(name="org.mpris.MediaPlayer2")]
        class Mpris2: Object
            construct(instance: Instance)
                _instance = instance
            
            prop readonly CanQuit: bool
                get
                    return true

            prop readonly CanRaise: bool
                get
                    return true

            prop readonly HasTrackList: bool
                get
                    // TODO: in the future?
                    return false

            prop readonly DesktopEntry: string
                owned get
                    // This name has a few uses:
                    //
                    // 1) The Ubuntu sound indicator will use it to identify us.
                    //
                    // 2) Refers to a "<name>.desktop" file that will be used for two things:
                    //   a) To start us if we are not running.
                    //   b) To display our icon.
                    //
                    // Locations for the desktop file must be the standard ones used by XDG, such as:
                    // "~/.local/share/applications/" and "/usr/share/applications/". Likewise, icons
                    // will be found in "~/.local/share/icons/" or "/usr/share/icons/". Note that
                    // full paths to icons in the desktop file will *not* work!
                    //
                    // 3) If the MusicIndicatorFeature is used (Ubuntu 11.10 and earlier),
                    // this name must be identical to the "music.<name>" type registered there.
                    return "khovsgol"

            prop readonly Identity: string
                owned get
                    return "Khövsgöl"

            prop readonly SupportedUriSchemes: array of string
                owned get
                    return {"file"}

            prop readonly SupportedMimeTypes: array of string
                owned get
                    return {
                        "application/x-ogg",
                        "application/ogg",
                        "audio/x-vorbis+ogg",
                        "audio/x-scpls",
                        "audio/x-mp3",
                        "audio/x-mpeg",
                        "audio/mpeg",
                        "audio/x-mpegurl",
                        "audio/x-flac",
                        "x-content/audio-cdda",
                        "x-content/audio-player"}

            def Quit()
                _instance.stop()

            def Raise()
                _instance.show()
            
            _instance: Instance

        [DBus(name="org.mpris.MediaPlayer2.Player")]
        class Mpris2Player: Object
            construct(instance: Instance, connector: Connector)
                _properties = new Properties(connector, "/org/mpris/MediaPlayer2", "org.mpris.MediaPlayer2.Player", _logger)
                _instance = instance
                _instance.api.play_mode_change.connect(on_play_mode_changed)
                _instance.api.cursor_mode_change.connect(on_cursor_mode_changed)
                _instance.api.position_in_track_change.connect(on_position_in_track_changed)
                _instance.api.track_change.connect(on_track_changed)

                var file = _instance.get_resource("khovsgol.svg")
                if file is not null
                    _default_art_url = file.get_uri()
            
            final
                _instance.api.play_mode_change.disconnect(on_play_mode_changed)
                _instance.api.cursor_mode_change.disconnect(on_cursor_mode_changed)
                _instance.api.position_in_track_change.disconnect(on_position_in_track_changed)
                _instance.api.track_change.disconnect(on_track_changed)

            prop PlaybackStatus: string?
                owned get
                    return _PlaybackStatus
                set
                    pass

            prop LoopStatus: string?
                owned get
                    return _LoopStatus
                set
                    _LoopStatus = value
                    if value == "None"
                        _instance.api.set_cursor_mode("playlist")
                    else if value == "Playlist"
                        _instance.api.set_cursor_mode("repeat_playlist")
                    else if value == "Track"
                        _instance.api.set_cursor_mode("repeat_track")

            prop Rate: double
            
            prop Shuffle: bool
                get
                    return _Shuffle
                set
                    _Shuffle = value
                    if value
                        _instance.api.set_cursor_mode("repeat_track")
                    else
                        _instance.api.set_cursor_mode("playlist")
                        
            prop readonly Metadata: HashTable of string, Variant?
                owned get
                    return _Metadata
                    
            prop Volume: double

            prop readonly Position: int64
            prop readonly MinimumRate: double
            prop readonly MaximimRate: double
            prop readonly CanGoNext: bool = true
            prop readonly CanGoPrevious: bool = true
            prop readonly CanPlay: bool
            prop readonly CanPause: bool
            prop readonly CanSeek: bool
            prop readonly CanControl: bool = false
            
            event Seeked(position: int64)
            
            def Next()
                _instance.api.set_position_in_playlist_string("next")

            def Previous()
                _instance.api.set_position_in_playlist_string("prev")

            def Pause()
                 _instance.api.set_play_mode("paused")

            def PlayPause()
                 _instance.api.set_play_mode("toggle_paused")

            def Stop()
                 _instance.api.set_play_mode("stopped")

            def Play()
                 _instance.api.set_play_mode("playing")

            def Seek(offset: int64)
                if _position_in_track != double.MIN
                    var position = _position_in_track + (offset / 1000000.0)
                    _instance.api.set_position_in_track(position)

            def SetPosition(obj: string, position: int64)
                pass

            def OpenUri(uri: string)
                pass
            
            _instance: Instance
            _position_in_track: double = double.MIN
            _Shuffle: bool
            _PlaybackStatus: string = "Stopped"
            _LoopStatus: string = "None"
            _Metadata: HashTable of string, Variant? = new HashTable of string, Variant(str_hash, str_equal)

            def private on_play_mode_changed(play_mode: string?, old_play_mode: string?)
                if play_mode == "playing"
                    _PlaybackStatus = "Playing"
                    _CanPause = true
                    _CanPlay = false
                else if play_mode == "paused"
                    _PlaybackStatus = "Paused"
                    _CanPause = false
                    _CanPlay = true
                else
                    _PlaybackStatus = "Stopped"
                    _CanPause = false
                    _CanPlay = true
                _properties.@set("PlaybackStatus", _PlaybackStatus)
                _properties.@set("CanPause", _CanPause)
                _properties.@set("CanPlay", _CanPlay)
                _properties.emit_changes()

            def private on_cursor_mode_changed(cursor_mode: string?, old_cursor_mode: string?)
                if cursor_mode == "album"
                    _LoopStatus = "None"
                    _Shuffle = false
                else if cursor_mode == "playlist"
                    _LoopStatus = "None"
                    _Shuffle = false
                else if cursor_mode == "repeat_track"
                    _LoopStatus = "Track"
                    _Shuffle = false
                else if cursor_mode == "repeat_album"
                    _LoopStatus = "None"
                    _Shuffle = false
                else if cursor_mode == "repeat_playlist"
                    _LoopStatus = "Playlist"
                    _Shuffle = false
                else if cursor_mode == "shuffle"
                    _LoopStatus = "None"
                    _Shuffle = true
                else if cursor_mode == "repeat_shuffle"
                    _LoopStatus = "Playlist"
                    _Shuffle = true
                _properties.@set("LoopStatus", _LoopStatus)
                _properties.@set("Shuffle", _Shuffle)
                _properties.emit_changes()
                
            def private on_position_in_track_changed(position_in_track: double, old_position_in_track: double, track_duration: double)
                _position_in_track = position_in_track
                if position_in_track != double.MIN
                    _Position = (int64) (position_in_track * 1000000)
                else
                    _Position = 0
                _properties.@set("Position", _Position)
                _properties.emit_changes()

            def private on_track_changed(track: Track?, old_track: Track?)
                _Metadata.remove_all()

                if track is not null
                    var path = track.path
                        if path is not null
                            var title = track.title
                            var artist = track.artist
                            var album = track.album
                            var duration = track.duration
                            
                            _Metadata.@set("mpris:trackid", path)
                            _Metadata.@set("xesam:title", title)
                            _Metadata.@set("xesam:artist", artist)
                            _Metadata.@set("xesam:album", album)
                            
                            if duration != double.MIN
                                _Metadata.@set("mpris:length", (int) duration * 1000000) // microseconds
                            
                            art_url: string = null
                            var file = find_cover(File.new_for_path(track.path).get_parent())
                            if file is not null
                                art_url = file.get_uri()
                            else
                                art_url = _default_art_url

                            if art_url is not null
                                _Metadata.@set("mpris:artUrl", art_url)
                                
                _properties.@set("Metadata", _Metadata)
                _properties.emit_changes()
            
            _properties: Properties
            _default_art_url: string?
