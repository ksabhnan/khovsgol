[indent=4]

uses
    JsonUtil

namespace Nap

    def set_json_object_or_not_found(has_json: HasJsonObject?, conversation: Conversation): bool
        if has_json is not null
            var json = has_json.to_json()
            if json.get_size() > 0
                conversation.response_json_object = json
                return true
        conversation.status_code = StatusCode.NOT_FOUND
        return false
    
    def set_json_array_or_not_found(has_json: HasJsonArray?, conversation: Conversation): bool
        if has_json is not null
            var json = has_json.to_json()
                if json.get_length() > 0
                    conversation.response_json_array = json
                    return true
        conversation.status_code = StatusCode.NOT_FOUND
        return false

    def get_json_object_or_bad_request(conversation: Conversation): Json.Object?
        var entity = conversation.get_entity()
        if entity is null
            conversation.status_code = StatusCode.BAD_REQUEST
            return null
        try
            return JsonUtil.from_object(entity)
        except e: JsonUtil.Error
            conversation.status_code = StatusCode.BAD_REQUEST
            return null

    def response_json_to_text(conversation: Conversation)
        if (conversation.response_json_object is not null) or (conversation.response_json_array is not null)
            var jsonp = conversation.query["jsonp"]
            var human = jsonp is null && conversation.query["human"] == "true"
            if conversation.response_json_object is not null
                conversation.response_text = JsonUtil.object_to(conversation.response_json_object, human)
            else
                conversation.response_text = JsonUtil.array_to(conversation.response_json_array, human)
            if jsonp is not null
                conversation.response_text = "%s(%s)".printf(jsonp, conversation.response_text)
            if conversation.response_media_type is null
                conversation.response_media_type = "application/json"

    def request_json_to_text(conversation: Conversation)
        if (conversation.request_json_object is not null) or (conversation.request_json_array is not null)
            if conversation.request_json_object is not null
                conversation.request_text = JsonUtil.object_to(conversation.request_json_object)
            else
                conversation.request_text = JsonUtil.array_to(conversation.request_json_array)
            if conversation.request_media_type is null
                conversation.request_media_type = "application/json"

    def default_error_handler(conversation: Conversation, error: GLib.Error)
        conversation.status_code = StatusCode.INTERNAL_SERVER_ERROR
        Logging.get_logger("nap").warningf("%s (%s %s)", error.message, conversation.method, conversation.path)

    /*
     * Simplified implementation of URI templates:
     * 
     * http://tools.ietf.org/html/rfc6570
     * 
     * Variables can be specified by the "{name}" notation. Patterns
     * ending in a "*" will match any suffix.
     */
    class Template
        /*
         * True is the template does not require a regex.
         */
        def static is_trivial(pattern: string): bool
            return !pattern.has_suffix("*") && (pattern.index_of_char('{') < 0)
        
        /*
         * Renders a pattern, filling the variables in order from the
         * arguments. Note that variable names have no meaning here.
         */
        def static render(pattern: string, ...): string
            var s = new StringBuilder()
            var args = va_list()

            var start = pattern.index_of_char('{')
            if start < 0
                s.append(pattern)
            else
                var last = 0
                while start >= 0
                    var after_start = start
                    if !pattern.get_next_char(ref after_start, null)
                        break
                    var end = pattern.index_of_char('}', after_start)
                    if end >= 0
                        s.append(pattern.slice(last, start))
                        value: string = args.arg()
                        s.append(value)
                        last = end
                        if !pattern.get_next_char(ref last, null)
                            break
                        start = pattern.index_of_char('{', last)
                    else
                        break
                if last < pattern.length
                    s.append(pattern.substring(last))

            return s.str

        /*
         * Renders a pattern, filling the variables (and URI-encoding
         * them) by name from the dict.
         */
        def static renderd(pattern: string, variables: dict of string, string): string
            var s = new StringBuilder()

            var start = pattern.index_of_char('{')
            if start < 0
                s.append(pattern)
            else
                var last = 0
                while start >= 0
                    var after_start = start
                    if !pattern.get_next_char(ref after_start, null)
                        break
                    var end = pattern.index_of_char('}', after_start)
                    if end >= 0
                        s.append(pattern.slice(last, start))
                        var variable = pattern.slice(after_start, end)
                        var value = variables[variable]
                        s.append(Soup.URI.encode(Soup.URI.encode(value, null), null))
                        last = end
                        if !pattern.get_next_char(ref last, null)
                            break
                        start = pattern.index_of_char('{', last)
                    else
                        break
                if last < pattern.length
                    s.append(pattern.substring(last))

            return s.str

        construct(pattern: string) raises RegexError
            var p = pattern
            var regex = new StringBuilder("^")
            
            wildcard: bool = false
            if p.has_suffix("*")
                p = p.substring(0, -1)
                wildcard = true
                
            var start = p.index_of_char('{')
            if start < 0
                regex.append(Regex.escape_string(p))
            else
                var last = 0
                while start >= 0
                    var after_start = start
                    if !pattern.get_next_char(ref after_start, null)
                        break
                    var end = p.index_of_char('}', after_start)
                    if end >= 0
                        regex.append(Regex.escape_string(p.slice(last, start)))
                        regex.append("(?<")
                        var variable = p.slice(after_start, end)
                        _variables.add(variable)
                        regex.append(variable)
                        regex.append(">[^/]*)")
                        last = end
                        if !pattern.get_next_char(ref last, null)
                            break
                        start = p.index_of_char('{', last)
                    else
                        break
                if last < p.length
                    regex.append(Regex.escape_string(p.substring(last)))
            
            if !wildcard
                regex.append("$")
                
            _regex = new Regex(regex.str)

        construct raw(regex: Regex)
            _regex = regex
    
        prop readonly regex: Regex
        prop readonly variables: list of string = new list of string
        
        /*
         * Checks if the conversation path matches the template. Note
         * that if template has variables, they will be extracted into
         * the conversation (and URI-decoded).
         */
        def matches(conversation: Conversation): bool
            info: MatchInfo
            if _regex.match(conversation.path, 0, out info)
                for variable in _variables
                    conversation.variables[variable] = Soup.URI.decode(info.fetch_named(variable))
                return true
            else
                return false

    /*
     * Keeps references for a list of objects.
     */
    class Ownerships
        construct()
            _list = new list of Object
    
        def add(ownership: Object): bool
            return _list.add(ownership)
    
        _list: list of Object

    /*
     * Renders an NCSA Common Log entry.
     */
    class NcsaCommonLogEntry
        prop address: string?
        prop user_identifier: string?
        prop user_id: string?
        prop timestamp: DateTime = new DateTime.now_local()
        prop method: string
        prop path: string
        prop protocol: string
        prop status_code: uint
        prop size: uint
        
        def get_formatted_timestamp(): string
            return _timestamp.format("%d/%b/%Y:%H:%M:%S %z")
        
        def to_string(): string
            return "%s %s %s [%s] \"%s %s %s\" %u %u".printf(dash(_address), dash(_user_identifier), dash(_user_id), get_formatted_timestamp(), _method, _path, _protocol, _status_code, _size)
                
        def private dash(str: string?): string
            if (str is null) || (str.length == 0)
                return "-"
            return str
