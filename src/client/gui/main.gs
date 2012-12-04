[indent=4]

uses
    Gtk

namespace Khovsgol.Client.GUI

    class MainWindow: Window
        construct(instance: Instance)
            _instance = instance
            
            var icon_file = File.new_for_path("/usr/share/pixmaps/khovsgol.svg")
            if !icon_file.query_exists()
                // Use system icon
                icon_name = "khovsgol"
            else
                // Use icon directly from file
                var base_dir = _instance.dir.get_parent()
                if base_dir is not null
                    icon_file = base_dir.get_child("resources").get_child("khovsgol.svg")
                    if icon_file.query_exists()
                        try
                            if !set_icon_from_file(icon_file.get_path())
                                _logger.warningf("Could not set icon: %s", icon_file.get_path())
                        except e: GLib.Error
                            _logger.warning(e.message)
            
            realize.connect(on_realized)
            delete_event.connect(on_delete)
            
            _control_bar = new ControlBar(_instance)
            _play_list = new PlayList(_instance)
            _library = new Library(_instance)

            _panes = new Paned(Orientation.HORIZONTAL)
            _panes.pack1(_play_list, true, true)
            _panes.pack2(_library, true, true)
            _panes.realize.connect(on_realize_panes)

            var main_box = new Box(Orientation.VERTICAL, 10)
            main_box.pack_start(_control_bar, false)
            main_box.pack_start(_panes)
            
            title = "Khövsgöl"
            deletable = false
            border_width = 10
            
            var x = _instance.configuration.x
            var y = _instance.configuration.y
            if (x != int.MIN) && (y != int.MIN)
                move(x, y)
            else
                set_position(WindowPosition.CENTER)

            var width = _instance.configuration.width
            var height = _instance.configuration.height
            if (width != int.MIN) && (height != int.MIN)
                set_default_size(width, height)
            else
                set_default_size(900, 600)

            add(main_box)
            add_accel_group(_control_bar.accel_group)
            add_accel_group(_play_list.accel_group)
            add_accel_group(_library.accel_group)
            /*if self.instance.configuration.is_boolean('ui', 'focus-on-library'):
                self.library_pane.tree_view.grab_focus()
            else:
                self.play_list_pane.tree_view.grab_focus()*/

            show_all()
            
            configure_event.connect(on_configured)
            _panes.notify.connect(on_split)
            
        prop readonly control_bar: ControlBar
        prop readonly play_list: PlayList
        prop readonly library: Library
              
        def private on_realized()
            _instance.api.reset_watch()
            _instance.api.update(true)
                
        def private on_delete(event: Gdk.EventAny): bool
            iconify()
            return true // bypass default delete handler
        
        def private on_configured(event: Gdk.EventConfigure): bool
            x: int
            y: int
            width: int
            height: int
            get_position(out x, out y)
            get_size(out width, out height)
            if (x != _instance.configuration.x) || (y != _instance.configuration.y) || (width != _instance.configuration.width) || (height != _instance.configuration.height)
                _instance.configuration.x = x
                _instance.configuration.y = y
                _instance.configuration.width = width
                _instance.configuration.height = height
                _instance.configuration.save()
            return false
        
        def private on_realize_panes()
            var split = _instance.configuration.split
            if split != int.MIN
                _panes.position = split
            else
                _panes.position = _panes.get_allocated_width() / 2

        def private on_split(param_spec: ParamSpec)
            var position = _panes.position
            if position != _instance.configuration.split
                _instance.configuration.split = position
                _instance.configuration.save()

        _instance: Instance
        _panes: Paned

        _logger: static Logging.Logger
        
        init
            _logger = Logging.get_logger("khovsgol.client.main")
