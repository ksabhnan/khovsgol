[indent=4]

uses
    Sqlite
    
namespace SqliteUtil

    /*
     * String join for Gee.Iterable.
     */
    def join(sep: string, items: Gee.Iterable of string): string
        var str = new StringBuilder()
        var i = items.iterator()
        while i.next()
            str.append(i.get())
            if i.has_next()
                str.append(sep)
        return str.str
    
    /*
     * String join for multiples of a string.
     */
    def join_same(sep: string, item: string, num: int): string
        var str = new StringBuilder()
        num--
        for var i = 0 to num
            str.append(item)
            if i < num
                str.append(sep)
        return str.str

    /*
     * Escapes a string for use in SQL's LIKE, where '\' is the escape
     * character.
     */
    def escape_like(text: string): string
        return text.replace("%", "\\%").replace("_", "\\_")
        
    /*
     * Wrapper for Sqlite.Statement rows, allowing fetching of column
     * values by name.
     */
    class Row
        construct(iterator: RowIterator)
            _iterator = iterator
        
        def get_text(name: string): string
            var value = _iterator.builder.constants[name]
            if value is null
                value = _iterator.statement->column_text(_iterator.column_names[name])
            return value

        def get_int(name: string): int
            return _iterator.statement->column_int(_iterator.column_names[name])

        def get_double(name: string): double
            return _iterator.statement->column_double(_iterator.column_names[name])
    
        _iterator: RowIterator
    
    /*
     * Row iterator for Sqlite.Statement.
     */
    class RowIterator: Object implements Gee.Iterator of Row
        construct(statement: Statement*, own_statement: bool, builder: QueryBuilder)
            _statement = statement
            _own_statement = own_statement
            _builder = builder

            var index = 1
            for var binding in builder.bindings
                if binding.holds(typeof(string))
                    _statement->bind_text(index++, (string) binding)
                else if binding.holds(typeof(int))
                    _statement->bind_int(index++, (int) binding)

            var columns = _statement->column_count()
            if columns > 0
                var last = columns - 1
                for var c = 0 to last
                    _column_names[_statement->column_name(c)] = c
        
        final
            if _own_statement
                delete _statement
            
        prop readonly statement: Statement*
        prop readonly builder: QueryBuilder
        prop readonly column_names: dict of string, int = new dict of string, int
        
        def next(): bool
            _first = false
            _result = _statement->step()
            return _result == ROW
        
        def new @get(): Row
            return new Row(self)
        
        def first(): bool
            return _first

        def has_next(): bool
            return true // TODO
        
        def remove()
            pass
            
        _first: bool = true
        _own_statement: bool
        _result: int
    
    /*
     * SQL query builder.
     */
    class QueryBuilder
        prop table: string
        prop readonly fields: list of string = new list of string
        prop readonly constants: dict of string, string = new dict of string, string
        prop readonly requirements: list of string = new list of string
        prop readonly bindings: list of GLib.Value? = new list of GLib.Value?
        prop readonly sort: list of string = new list of string
        prop constraint: string? = null
        
        prop readonly as_sql: string
            owned get
                if _sql is null
                    var query = new StringBuilder()
                    query.append("SELECT ")
                    if (constraint is not null) and (constraint.length > 0)
                        query.append(constraint)
                        query.append(" ")
                    query.append(join(",", fields))
                    query.append(" FROM ")
                    query.append(table)
                    if !requirements.is_empty
                        query.append(" WHERE ")
                        query.append(join(" AND ", requirements))
                    if !sort.is_empty
                        query.append(" ORDER BY ")
                        query.append(join(",", sort))

                    _sql = query.str
                return _sql
        
        def add_fields(first: string, ...)
            _fields.add(first)
            var args = va_list()
            arg: string? = args.arg()
            while arg is not null
                _fields.add(arg)
                arg = args.arg()
        
        def execute(db: Database, cache: StatementCache? = null): RowIterator raises SqliteUtil.Error
            statement: Statement*
            if cache is not null
                statement = cache.get_or_prepare_statement(as_sql, db)
                return new RowIterator(statement, false, self)
            else
                db.prepare(out statement, as_sql)
                return new RowIterator(statement, true, self)
        
        _sql: string

    /*
     * Thread-safe cache of reusable prepared statements.
     */
    class StatementCache
        final
            for var key in _locks.keys
                g_mutex_free(_locks[key])

            for var key in _statements.keys
                var value = _statements[key]
                if value is not null
                    delete value
    
        def get_lock(sql: string): GLib.Mutex*
            _lock.lock()
            try
                var @lock = _locks[sql]
                if @lock is null
                    @lock = g_mutex_new()
                    _locks[sql] = @lock
                return @lock
            finally
                _lock.unlock()
        
        def get_or_prepare_statement(sql: string, db: Database): Statement* raises SqliteUtil.Error
            _lock.lock()
            try
                var statement = _statements[sql]
                if statement is null
                    db.prepare(out statement, sql)
                    _statements[sql] = statement
                else
                    statement->reset()
                return statement
            finally
                _lock.unlock()
        
        _lock: GLib.Mutex = GLib.Mutex()
        _locks: dict of string, GLib.Mutex* = new dict of string, GLib.Mutex*
        _statements: dict of string, Statement* = new dict of string, Statement*

def extern g_mutex_new(): GLib.Mutex*
def extern g_mutex_free(mutex: GLib.Mutex*)
