[indent=4]

uses
    Gtk

namespace Khovsgol.GUI

    //def get_stock_icon_pixbuf(window, name):
      //  return window.render_icon(getattr(Gtk, 'STOCK_' + name), Gtk.IconSize.MENU, None)

    class ControlButton: Button
        construct(id: string, alt_key: uint, tooltip: string, accel_group: AccelGroup)
            image = new Image.from_stock(id, IconSize.BUTTON)
            relief = ReliefStyle.NONE
            add_accelerator("clicked", accel_group, alt_key, Gdk.ModifierType.MOD1_MASK, AccelFlags.VISIBLE|AccelFlags.LOCKED)
            tooltip_text = tooltip

    class ControlToolButton: ToolButton
        construct(id: string, alt_key: uint, tooltip: string, accel_group: AccelGroup)
            stock_id = id
            add_accelerator("clicked", accel_group, alt_key, Gdk.ModifierType.MOD1_MASK, AccelFlags.VISIBLE|AccelFlags.LOCKED)
            tooltip_text = tooltip

    class ControlToggleToolButton: ToggleToolButton
        construct(id: string, alt_key: uint, tooltip: string, accel_group: AccelGroup)
            stock_id = id
            add_accelerator("clicked", accel_group, alt_key, Gdk.ModifierType.MOD1_MASK, AccelFlags.VISIBLE|AccelFlags.LOCKED)
            tooltip_text = tooltip

    class EntryBox: Box
        construct(label: string, name: string? = null, value: string? = null)
            orientation = Orientation.HORIZONTAL
            spacing = 5
            _entry = new Entry()
            if name is not null
                _entry.name = name
            /*if sensitivity is not null
                entry.set_sensitive(sensitivity)*/
            if value is not null
                entry.text = value
            var l = new Label.with_mnemonic(label)
            l.use_markup = true
            l.mnemonic_widget = entry
            pack_start(l, false)
            pack_start(_entry)
        
        prop readonly entry: Entry

    class SimpleComboBox: Box
        construct(name: string? = null, label: string? = null)
            orientation = Orientation.HORIZONTAL
            spacing = 5
            
            _store = new ListStore(2, typeof(Value), typeof(string))
                
            _combo_box = new ComboBox.with_model(_store)
            if name is not null
                _combo_box.name = name
            var renderer = new CellRendererText()
            _combo_box.pack_start(renderer, true)
            _combo_box.add_attribute(renderer, "text", 1)
            
            if label is not null
                var l = new Label.with_mnemonic(label)
                l.use_markup = true
                l.mnemonic_widget = _combo_box
                pack_start(l, false)

            pack_start(_combo_box)
        
        def append(value: Value, label: string)
            i: TreeIter
            _store.append(out i)
            _store.set(i, 0, value)
            _store.set(i, 1, label)

        _store: ListStore
        _combo_box: ComboBox
