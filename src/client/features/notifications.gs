[indent=4]

uses
    JsonUtil

namespace Khovsgol.Client.Features

    /*
     * FreeDesktop Notifications feature.
     * 
     * Sends a desktop notification every time the current track
     * changes.
     */
    class NotificationsFeature: Object implements Feature
        prop readonly name: string = "notification"
        prop readonly label: string = "Desktop notifications"
        prop readonly persistent: bool = true
        prop readonly state: FeatureState
            get
                return (FeatureState) AtomicInt.@get(ref _state)

        prop instance: Instance
        
        def start()
            if state == FeatureState.STOPPED
                set_state(FeatureState.STARTING)

                var file = _instance.get_resource("khovsgol.svg")
                if file is not null
                    _default_icon = file.get_path()
                else
                    _default_icon = "stock_media-play"

                try
                    _notifications = Bus.get_proxy_sync(BusType.SESSION, "org.freedesktop.Notifications", "/org/freedesktop/Notifications")
                    
                    var capabilities = _notifications.get_capabilities()
                    for var capability in capabilities
                        if capability == "body-markup"
                            _markup = true
                            _logger.info("Supports markup")
                            break
                        
                    _instance.api.track_change.connect(on_track_changed)
                    _instance.api.error.connect(on_error)
                    set_state(FeatureState.STARTED)
                except e: IOError
                    _logger.exception(e)
                    set_state(FeatureState.STOPPED)
        
        def stop()
            if state == FeatureState.STARTED
                set_state(FeatureState.STOPPING)
                _instance.api.track_change.disconnect(on_track_changed)
                _instance.api.error.disconnect(on_error)
                _notifications = null
                set_state(FeatureState.STOPPED)
        
        _state: int = FeatureState.STOPPED
        _notifications: Notifications?
        _markup: bool
        
        def private set_state(state: FeatureState)
            AtomicInt.@set(ref _state, state)
            _logger.message(get_name_from_feature_state(state))
            state_change(state)

        def private on_track_changed(track: Track?, old_track: Track?)
            if track is not null
                var path = track.path
                if path != _last_path
                    _last_path = path
                    var title = track.title
                    if title is not null
                        var artist = track.artist
                        var album = track.album
                        var position = track.position_in_album
                        
                        if _markup
                            title = Markup.escape_text(title)
                        //title = format_annotation(title)
                        if artist is not null
                            if _markup
                                artist = Markup.escape_text(artist)
                        if album is not null
                            if _markup
                                album = Markup.escape_text(album)
                            //album = format_annotation(album)
                            pass
                        markup: string
                        if (artist is not null) and (album is not null) and (position != int.MIN)
                            if _markup
                                markup = "<b>%s</b>\rBy <i>%s</i>\r%s in %s".printf(title, artist, format_ordinal(position), album)
                            else
                                markup = "%s\rBy %s\r%s in %s".printf(title, artist, format_ordinal(position), album)
                        else if (artist is not null) and (album is not null)
                            if _markup
                                markup = "<b>%s</b>\rBy <i>%s</i>\rIn %s".printf(title, artist, album)
                            else
                                markup = "%s\rBy %s\rIn %s".printf(title, artist, album)
                        else if (artist is not null) and (album is null)
                            if _markup
                                markup = "<b>%s</b>\rBy <i>%s</i>".printf(title, artist)
                            else
                                markup = "%s\rBy %s".printf(title, artist)
                        else if (artist is null) and (album is not null)
                            if _markup
                                markup = "<b>%s</b>\rIn %s".printf(title, album)
                            else
                                markup = "%s\rIn %s".printf(title, album)
                        else
                            markup = title
                            
                        icon: string
                        var file = find_cover(File.new_for_path(track.path).get_parent())
                        if file is not null
                            icon = file.get_path()
                        else
                            icon = _default_icon
                            
                        try
                            _notifications.notify("Khövsgöl", track.position_in_playlist, icon, "Khövsgöl", markup, _actions, _hints, DURATION)
                            _logger.infof("Notified new track: %s", track.path)
                        except e: IOError
                            _logger.exception(e)
        
        def private on_error(e: GLib.Error)
            var markup = Markup.escape_text(e.message)
            try
                _notifications.notify("Khövsgöl", 0, _default_icon, "Khövsgöl", markup, _actions, _hints, DURATION)
            except e: IOError
                _logger.exception(e)

        _actions: array of string = new array of string[0] // {"close", "OK"}
        _hints: HashTable of string, Variant = new HashTable of string, Variant(str_hash, str_equal) // {x: 0, y: 0}
        _default_icon: string
        _last_path: string?
        
        const DURATION: int = 2000

        _logger: static Logging.Logger
        
        init
            _logger = Logging.get_logger("khovsgol.notifications")

    [DBus(name="org.freedesktop.Notifications")]
    interface private Notifications: Object
        def abstract get_capabilities(): array of string raises IOError
        def abstract notify(app_name: string, replaces_id: uint32, app_icon: string, summary: string, body: string, actions: array of string, hints: HashTable of (string, Variant), expires_timeout: int32): uint32 raises IOError
        event notification_closed(id: uint32, reason: uint32)
        event action_invoked(id: uint32, action_key: string)
