[indent=4]

uses
    Gtk
    JsonUtil
    Khovsgol

namespace Khovsgol.GUI

    class Library: Alignment
        construct(instance: Instance)
            _instance = instance
            _accel_group = new AccelGroup()

            unrealize.connect(on_unrealized)
            
            // Popup menus
            
            _popup_none = create_popup_menu()
            _popup = create_popup_menu(true)
            _popup_custom = create_popup_menu(true, true)
        
            // Top
            
            _filter_box = new EntryBox("_Filter:")
            var clear_filter_button = new ControlButton(Stock.CLEAR, Gdk.Key.T, "Reset library filter\n<Alt>T", _accel_group)
            clear_filter_button.clicked.connect(on_clear_filter)
            _filter_box.pack_start(clear_filter_button, false)
            _filter_box.entry.activate.connect(on_filter)

            var top_box = new Box(Orientation.HORIZONTAL, 5)
            top_box.pack_start(_filter_box)

            // Tree
            
            _store = new TreeStore(4, typeof(Json.Node), typeof(string), typeof(string), typeof(string)) // node, search, markup1, markup2
            
            var renderer1 = new CellRendererText()
            renderer1.ellipsize = Pango.EllipsizeMode.END // This also mysteriously enables right alignment for RTL text
            var renderer2 = new CellRendererText()
            renderer2.xalign = 1
            renderer2.alignment = Pango.Alignment.RIGHT
            var column = new TreeViewColumn()
            column.pack_start(renderer1, true)
            column.pack_start(renderer2, false)
            column.add_attribute(renderer1, "markup", Column.MARKUP1)
            column.add_attribute(renderer2, "markup", Column.MARKUP2)
            column.set_cell_data_func(renderer2, on_markup2_render)

            _tree_view = new ClickableDraggableTreeView()
            _tree_view.model = _store
            _tree_view.headers_visible = false
            _tree_view.get_selection().mode = SelectionMode.MULTIPLE
            _tree_view.set_row_separator_func(on_row_separator)
            _tree_view.append_column(column)
            _tree_view.search_column = 1
            _tree_view.enable_model_drag_source(Gdk.ModifierType.BUTTON1_MASK, DRAG_TARGETS, Gdk.DragAction.LINK)
            _tree_view.enable_model_drag_dest(DROP_TARGETS, Gdk.DragAction.LINK|Gdk.DragAction.MOVE)
            _tree_view.button_press_event.connect(on_clicked)
            _tree_view.double_click.connect(on_double_clicked)
            _tree_view.right_click.connect(on_right_clicked)
            _tree_view.key_press_event.connect(on_key_pressed)
            _tree_view.test_expand_row.connect(on_expanded)
            _tree_view.drag_data_get.connect(on_dragged)
            _tree_view.drag_data_received.connect(on_dropped)
            var tree_scrolled = new ScrolledWindow(null,  null)
            tree_scrolled.add(_tree_view)
            var tree_frame = new Frame(null)
            tree_frame.add(tree_scrolled)
            
            // Bottom
            
            _style_box = new StyleComboBox()
            _style_box.append(new ArtistsAndTheirAlbums())
            _style_box.append(new ArtistsAndTheirTracks())
            _style_box.append(new YearsAndAlbums())
            _style_box.append(new AllAlbums())
            _style_box.append(new CustomCompilations())
            var style = _instance.configuration.library_style
            if style is not null
                _style_box.active_style_name = style
            else
                _style_box.active_style_name = "artists_albums"
            _style_box.changed.connect(on_style)

            var actions_button = new Button()
            actions_button.image = new Image.from_stock(Stock.EXECUTE, IconSize.BUTTON)
            actions_button.relief = ReliefStyle.NONE
            actions_button.tooltip_text = "Library actions"
            actions_button.button_press_event.connect(on_actions)

            var bottom_box = new Box(Orientation.HORIZONTAL, 5)
            bottom_box.pack_start(_style_box)
            bottom_box.pack_start(actions_button, false)

            // Assemble

            var box = new Box(Orientation.VERTICAL, 10)
            box.pack_start(top_box, false)
            box.pack_start(tree_frame)
            box.pack_start(bottom_box, false)
        
            add(box)
            set(0, 0, 1, 1)
            
            on_filter()
        
        prop readonly accel_group: AccelGroup
            
        def private on_unrealized()
            pass

        //def private on_progress_render(layout: CellLayout, renderer: CellRenderer, model: TreeModel, iter: TreeIter)
          //  pass
            
        def private on_markup2_render(layout: CellLayout, renderer: CellRenderer, model: TreeModel, iter: TreeIter)
            pass
            
        def private on_row_separator(mode: TreeModel, iter: TreeIter): bool
            value: Value
            _store.get_value(iter, Column.NODE, out value)
            return ((Json.Node) value).get_node_type() == Json.NodeType.NULL
        
        def private on_clicked(event: Gdk.EventButton): bool
            // TODO: do we need this?
            return false

        def private on_double_clicked(e: Gdk.EventButton)
            on_add()

        def private on_right_clicked(e: Gdk.EventButton)
            var selections = _tree_view.get_selection().count_selected_rows()
            if selections == 0
                _popup_none.popup(null, null, null, e.button, e.time)
            else
                _popup.popup(null, null, null, e.button, e.time)

        def private on_key_pressed(e: Gdk.EventKey): bool
            if e.keyval == Gdk.Key.Menu
                var selections = _tree_view.get_selection().count_selected_rows()
                if selections == 0
                    _popup_none.popup(null, null, null, 0, e.time)
                else
                    _popup.popup(null, null, null, 0, e.time)
            return false
        
        def private on_expanded(iter: TreeIter, path: TreePath): bool
            // Check for placeholder
            placeholder_iter: TreeIter
            if _store.iter_children(out placeholder_iter, iter)
                value: Value
                _store.get_value(placeholder_iter, Column.NODE, out value)
                if (Json.Node) value == null
                    // We found the placeholder, so use the active style to fill
                    _store.remove(ref placeholder_iter)
                    var style = _style_box.active_style
                    if style is not null
                        var node = new LibraryNode(_instance, _tree_view, _store, iter)
                        ((LibraryStyle) style).fill(node)
                        if node.is_frozen
                            _tree_view.thaw_child_notify()
            return false
        
        def private on_dragged(context: Gdk.DragContext, selection_data: SelectionData, info: uint, time: uint)
            var tracks = gather_selected_tracks()
            if tracks is not null
                selection_data.@set(selection_data.get_target(), 8, array_to(tracks).data)
        
        def private on_dropped(context: Gdk.DragContext, x: int, y: int, selection_data: SelectionData, info: uint, time: uint)
            pass

        def private on_filter()
            _tree_view.freeze_child_notify()
            _tree_view.model = null
            _store.clear()
            var style = _style_box.active_style
            if style is not null
                var node = new LibraryNode(_instance, _tree_view, _store)
                node.is_frozen = true
                ((LibraryStyle) style).fill(node)
            _tree_view.model = _store
            _tree_view.thaw_child_notify()
        
        def private on_clear_filter()
            _filter_box.entry.text = ""
            on_filter()

        def private on_style()
            var style = _style_box.active_style
            if (style is not null) && (style.name != _instance.configuration.library_style)
                _instance.configuration.library_style = style.name
                _instance.configuration.save()
            on_filter()

        def private on_add()
            var tracks = gather_selected_tracks()
            if tracks is not null
                _instance.api.add_to_play_list(_instance.player, int.MIN, tracks, true, true)

        def private on_add_at()
            pass

        def private on_delete()
            pass

        def private on_popup_extra()
            var window = new Window()
            window.title = "Khövsgöl Library Browser"
            window.set_position(WindowPosition.CENTER)
            window.set_default_size(500, 600)
            window.border_width = 10
            window.add(new Library(_instance))
            window.show_all()

        def private on_actions(e: Gdk.EventButton): bool
            on_right_clicked(e)
            return false
            
        def private gather_selected_tracks(): Json.Array?
            var style = _style_box.active_style
            if style is not null
                var selection = _tree_view.get_selection()
                var tree_paths = selection.get_selected_rows(null)
                if tree_paths.length() > 0
                    iter: TreeIter
                    var data = new Json.Array()
                    for var tree_path in tree_paths
                        if _store.get_iter(out iter, tree_path)
                            var node = new LibraryNode(_instance, _tree_view, _store, iter)
                            ((LibraryStyle) style).gather_tracks(node, ref data)
                    return data
            return null

        def create_popup_menu(has_items: bool = false, is_compilation: bool = false): Gtk.Menu
            var menu = new Gtk.Menu()
            item: Gtk.MenuItem
            if has_items
                item = new Gtk.MenuItem.with_mnemonic("Add to end of playlist")
                item.activate.connect(on_add)
                menu.append(item)
                item = new Gtk.MenuItem.with_mnemonic("Add to after currently playing track")
                item.activate.connect(on_add_at)
                menu.append(item)
                if is_compilation
                    menu.append(new SeparatorMenuItem())
                    item = new Gtk.MenuItem.with_mnemonic("Delete these tracks from my compilations")
                    item.activate.connect(on_delete)
                    menu.append(item)
                menu.append(new SeparatorMenuItem())
            item = new Gtk.MenuItem.with_mnemonic("Popup an extra library browser")
            item.activate.connect(on_popup_extra)
            menu.append(item)
            menu.show_all()
            return menu

        _instance: Instance
        _store: TreeStore
        _tree_view: ClickableDraggableTreeView
        _filter_box: EntryBox
        _style_box: StyleComboBox
        _popup_none: Gtk.Menu
        _popup: Gtk.Menu
        _popup_custom: Gtk.Menu

        enum private Column
            NODE = 0     // Json.Node
            SEARCH = 1   // string
            MARKUP1 = 2  // string
            MARKUP2 = 3  // string

        const private DRAG_TARGETS: array of TargetEntry = {
            {"JSON_ARRAY",        TargetFlags.SAME_WIDGET, 0},
            {"JSON_STRING_ARRAY", TargetFlags.SAME_APP,    1}, // name, flags, id
            {"TEXT",              0,                       2},
            {"STRING",            0,                       3},
            {"text/plain",        0,                       4}}

        const private DROP_TARGETS: array of TargetEntry = {
            {"JSON_ARRAY",        TargetFlags.SAME_WIDGET, 0},
            {"JSON_STRING_ARRAY", TargetFlags.SAME_APP,    1}}