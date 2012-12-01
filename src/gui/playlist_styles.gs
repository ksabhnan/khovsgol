[indent=4]

uses
    Gtk
    JsonUtil
    Khovsgol

namespace Khovsgol.GUI
    
    interface PlayListStyle: Style
        def abstract fill(node: PlayListNode)
        def abstract gather_positions(node: PlayListNode, ref positions: Json.Array)
        def abstract get_first_position(node: PlayListNode): int
    
    class GroupByAlbums: GLib.Object implements Style, PlayListStyle
        const private ALBUM_POSITION: int = -2

        prop readonly name: string = "group_by_albums"
        prop readonly label: string = "Group by albums"
        
        def fill(node: PlayListNode)
            var tracks = node.tracks
            if tracks.get_length() > 0
                current_album_path: string? = null
                current_album_positions: Json.Array? = null
                show_artist: bool = true
                var albums = new dict of string, Json.Object
                for var i = 0 to (tracks.get_length() - 1)
                    var track = get_object_element_or_null(tracks, i)
                    
                    var album_path = get_string_member_or_null(track, "album_path")
                    if album_path != current_album_path
                        current_album_path = album_path
                        current_album_positions = null
                        var album = albums[current_album_path]
                        if album is null
                            album = node.instance.api.get_album(current_album_path)
                        if album is not null
                            albums[current_album_path] = album
                            var compilation = get_int_member_or_min(album, "compilation")
                            if compilation != int.MIN
                                show_artist = compilation != 0
                            
                            var title = get_string_member_or_null(album, "title")
                            if title is not null
                                var artist = get_string_member_or_null(album, "artist")
                                markup1: string
                                if artist is not null
                                    markup1 = "%s - <i>%s</i>".printf(Markup.escape_text(title), Markup.escape_text(artist))
                                else
                                    markup1 = Markup.escape_text(title)
                                markup1 = "<span size=\"smaller\" weight=\"bold\">%s</span>".printf(markup1)
                                if i > 0
                                    node.append_separator()
                                node.append_object(album, ALBUM_POSITION, null, markup1)
                                
                                current_album_positions = new Json.Array()
                                album.set_array_member("positions", current_album_positions)
                            
                    var title = get_string_member_or_null(track, "title")
                    if title is not null
                        var title_sort = get_string_member_or_null(track, "title_sort")
                        var position = get_int_member_or_min(track, "position")
                        var duration = get_double_member_or_min(track, "duration")
                        title = Markup.escape_text(title)
                        title = format_annotation(title)
                        markup1: string
                        if show_artist
                            var artist = get_string_member_or_null(track, "artist")
                            if artist is not null
                                artist = Markup.escape_text(artist)
                                markup1 = "%d\t%s - <i>%s</i>".printf(position, title, artist)
                            else
                                markup1 = "%d\t%s".printf(position, title)
                        else
                            markup1 = "%d\t%s".printf(position, title)
                        var markup2 = format_duration(duration)
                        node.append_object(track, position, title_sort, markup1, markup2)
                        if current_album_positions is not null
                            current_album_positions.add_int_element(position)
                        
        def gather_positions(node: PlayListNode, ref positions: Json.Array)
            var position = node.position
            if position == ALBUM_POSITION
                var album = node.as_object
                if album is not null
                    var album_positions = get_array_member_or_null(album, "positions")
                    if album_positions is not null
                        array_concat(positions, album_positions)
                    
            else if position > 0
                var track = node.as_object
                if track is not null
                    var track_position = get_int_member_or_min(track, "position")
                    if track_position != int.MIN
                        positions.add_int_element(track_position)

        def get_first_position(node: PlayListNode): int
            var position = node.position
            if position == ALBUM_POSITION
                var album = node.as_object
                if album is not null
                    var album_positions = get_array_member_or_null(album, "positions")
                    if (album_positions is not null) && (album_positions.get_length() > 0)
                        return get_int_element_or_min(album_positions, 0)
                    
            else if position > 0
                var track = node.as_object
                if track is not null
                    return get_int_member_or_min(track, "position")
            
            return int.MIN
     
    class Compact: GLib.Object implements Style, PlayListStyle
        prop readonly name: string = "compact"
        prop readonly label: string = "Compact"
        
        def fill(node: PlayListNode)
            var tracks = node.tracks
            if tracks.get_length() > 0
                for var i = 0 to (tracks.get_length() - 1)
                    var track = get_object_element_or_null(tracks, i)
                    var title = get_string_member_or_null(track, "title")
                    if title is not null
                        var title_sort = get_string_member_or_null(track, "title_sort")
                        var position = get_int_member_or_min(track, "position")
                        var duration = get_double_member_or_min(track, "duration")
                        var artist = get_string_member_or_null(track, "artist")
                        title = Markup.escape_text(title)
                        title = format_annotation(title)
                        markup1: string
                        if artist is not null
                            artist = Markup.escape_text(artist)
                            markup1 = "%d\t%s - <i>%s</i>".printf(position, title, artist)
                        else
                            markup1 = "%d\t%s".printf(position, title)
                        var markup2 = Markup.escape_text(format_duration(duration))
                        node.append_object(track, position, title_sort, markup1, markup2)

        def gather_positions(node: PlayListNode, ref positions: Json.Array)
            var track = node.as_object
            if track is not null
                var track_position = get_int_member_or_min(track, "position")
                if track_position != int.MIN
                    positions.add_int_element(track_position)

        def get_first_position(node: PlayListNode): int
            var track = node.as_object
            if track is not null
                return get_int_member_or_min(track, "position")
            else
                return int.MIN
            
    class Extended: GLib.Object implements Style, PlayListStyle
        prop readonly name: string = "extended"
        prop readonly label: string = "Extended"
        
        def fill(node: PlayListNode)
            var tracks = node.tracks
            if tracks.get_length() > 0
                for var i = 0 to (tracks.get_length() - 1)
                    var track = get_object_element_or_null(tracks, i)
                    var title = get_string_member_or_null(track, "title")
                    if title is not null
                        var title_sort = get_string_member_or_null(track, "title_sort")
                        var position = get_int_member_or_min(track, "position")
                        var duration = get_double_member_or_min(track, "duration")
                        var artist = get_string_member_or_null(track, "artist")
                        var album = get_string_member_or_null(track, "album")
                        title = Markup.escape_text(title)
                        title = format_annotation(title)
                        if artist is not null
                            artist = Markup.escape_text(artist)
                        if album is not null
                            album = Markup.escape_text(album)
                            album = format_annotation(album)
                        markup1: string
                        if (artist is not null) and (album is not null)
                            markup1 = "%d\t%s\r\t<span size=\"smaller\">By <i>%s</i></span>\r\t<span size=\"smaller\">In %s</span>".printf(position, title, artist, album)
                        else if (artist is not null) and (album is null)
                            markup1 = "%d\t%s\r\t<span size=\"smaller\">By <i>%s</i></span>".printf(position, title, artist)
                        else if (artist is null) and (album is not null)
                            markup1 = "%d\t%s\r\t<span size=\"smaller\">In %s</span>".printf(position, title, album)
                        else
                            markup1 = "%d\t%s".printf(position, title)
                        var markup2 = Markup.escape_text(format_duration(duration))
                        node.append_object(track, position, title_sort, markup1, markup2)

        def gather_positions(node: PlayListNode, ref positions: Json.Array)
            var track = node.as_object
            if track is not null
                var track_position = get_int_member_or_min(track, "position")
                if track_position != int.MIN
                    positions.add_int_element(track_position)

        def get_first_position(node: PlayListNode): int
            var track = node.as_object
            if track is not null
                return get_int_member_or_min(track, "position")
            else
                return int.MIN
