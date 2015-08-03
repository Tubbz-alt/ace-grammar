/**
*
*   AceGrammar
*   @version: 0.11
*
*   Transform a grammar specification in JSON format, into an ACE syntax-highlight parser mode
*   https://github.com/foo123/ace-grammar
*
**/!function( root, name, factory ) {
    "use strict";
    
    //
    // export the module, umd-style (no other dependencies)
    var isCommonJS = ("object" === typeof(module)) && module.exports, 
        isAMD = ("function" === typeof(define)) && define.amd, m;
    
    // CommonJS, node, etc..
    if ( isCommonJS ) 
        module.exports = (module.$deps = module.$deps || {})[ name ] = module.$deps[ name ] || (factory.call( root, {NODE:module} ) || 1);
    
    // AMD, requireJS, etc..
    else if ( isAMD && ("function" === typeof(require)) && ("function" === typeof(require.specified)) && require.specified(name) ) 
        define( name, ['require', 'exports', 'module'], function( require, exports, module ){ return factory.call( root, {AMD:module} ); } );
    
    // browser, web worker, etc.. + AMD, other loaders
    else if ( !(name in root) ) 
        (root[ name ] = (m=factory.call( root, {} ) || 1)) && isAMD && define( name, [], function( ){ return m; } );


}(  /* current root */          this, 
    /* module name */           "AceGrammar",
    /* module factory */        function( exports ) {
        
    /* main code starts here */

"use strict";

//
// parser types
var    
    DEFAULTSTYLE,
    DEFAULTERROR,
    
    //
    // javascript variable types
    INF = Infinity,
    
    //
    // matcher types
    T_SIMPLEMATCHER = 2,
    T_COMPOSITEMATCHER = 4,
    T_BLOCKMATCHER = 8,
    
    //
    // token types
    T_ERROR = 4,
    T_DEFAULT = 8,
    T_SIMPLE = 16,
    T_EOL = 17,
    T_NONSPACE = 18,
    T_EMPTY = 20,
    T_BLOCK = 32,
    T_ESCBLOCK = 33,
    T_COMMENT = 34,
    T_EITHER = 64,
    T_ALL = 128,
    T_REPEATED = 256,
    T_ZEROORONE = 257,
    T_ZEROORMORE = 258,
    T_ONEORMORE = 259,
    T_GROUP = 512,
    T_NGRAM = 1024,
    T_INDENT = 2048,
    T_DEDENT = 4096,
    
    //
    // tokenizer types
    groupTypes = {
        EITHER: T_EITHER, ALL: T_ALL, 
        ZEROORONE: T_ZEROORONE, ZEROORMORE: T_ZEROORMORE, ONEORMORE: T_ONEORMORE, 
        REPEATED: T_REPEATED
    },
    
    tokenTypes = {
        INDENT: T_INDENT, DEDENT: T_DEDENT,
        BLOCK: T_BLOCK, COMMENT: T_COMMENT, ESCAPEDBLOCK: T_ESCBLOCK, 
        SIMPLE: T_SIMPLE, GROUP: T_GROUP, NGRAM: T_NGRAM
    }
;

var undef = undefined, PROTO = 'prototype', HAS = 'hasOwnProperty', IS_ENUM = 'propertyIsEnumerable',
    Keys = Object.keys, AP = Array[PROTO], OP = Object[PROTO], FP = Function[PROTO],
    toString = OP.toString,
    
    // types
    //T_INF = 5,
    T_NUM = 4, T_NAN = 5,  T_BOOL = 8,
    T_STR = 16, T_CHAR = 17, T_CHARLIST = 18,
    T_ARRAY = 32, T_OBJ = 64, T_FUNC = 128,  T_REGEX = 256, T_DATE = 512,
    T_NULL = 1024, T_UNDEF = 2048, T_UNKNOWN = 4096,
    T_STR_OR_ARRAY = T_STR|T_ARRAY, T_OBJ_OR_ARRAY = T_OBJ|T_ARRAY,
    TO_STRING = {
        "[object Array]"    : T_ARRAY,
        "[object RegExp]"   : T_REGEX,
        "[object Date]"     : T_DATE,
        "[object Number]"   : T_NUM,
        "[object String]"   : T_STR,
        "[object Function]" : T_FUNC,
        "[object Object]"   : T_OBJ
    },
    get_type = function( v ) {
        var /*type_of,*/ to_string;
        
        if (null === v)  return T_NULL;
        else if (true === v || false === v)  return T_BOOL;
        else if (undef === v /*|| "undefined" === type_of*/)  return T_UNDEF;
        
        //type_of = typeOf(v);
        to_string = toString.call( v );
        //to_string = TO_STRING[HAS](to_string) ? TO_STRING[to_string] : T_UNKNOWN;
        to_string = TO_STRING[to_string] || T_UNKNOWN;
        
        //if (undef === v /*|| "undefined" === type_of*/)  return T_UNDEF;
        if (T_NUM === to_string || v instanceof Number)  return isNaN(v) ? T_NAN : T_NUM;
        else if (T_STR === to_string || v instanceof String) return (1 === v.length) ? T_CHAR : T_STR;
        else if (T_ARRAY === to_string || v instanceof Array)  return T_ARRAY;
        else if (T_REGEX === to_string || v instanceof RegExp)  return T_REGEX;
        else if (T_DATE === to_string || v instanceof Date)  return T_DATE;
        else if (T_FUNC === to_string || v instanceof Function)  return T_FUNC;
        else if (T_OBJ === to_string)  return T_OBJ;
        // unkown type
        return T_UNKNOWN;
    },
    
    Extend = Object.create,
    Merge = function(/* var args here.. */) { 
        var args = arguments, argslen, 
            o1, o2, v, p, i, T;
        o1 = args[0] || {}; 
        argslen = args.length;
        for (i=1; i<argslen; i++)
        {
            o2 = args[ i ];
            if ( T_OBJ === get_type( o2 ) )
            {
                for (p in o2)
                {            
                    if ( o2[HAS](p) && o2[IS_ENUM](p) ) 
                    {
                        v = o2[p];
                        T = get_type( v );
                        
                        if ( T_NUM & T )
                            // shallow copy for numbers, better ??
                            o1[p] = 0 + v;  
                        
                        else if ( T_STR_OR_ARRAY & T )
                            // shallow copy for arrays or strings, better ??
                            o1[p] = v.slice(0);  
                        
                        else
                            // just reference copy
                            o1[p] = v;  
                    }
                }
            }
        }
        return o1; 
    },
    
    make_array = function(a, force) {
        return ( force || T_ARRAY !== get_type( a ) ) ? [ a ] : a;
    },
    
    make_array_2 = function(a, force) {
        a = make_array( a, force );
        if ( force || T_ARRAY !== get_type( a[0] ) ) a = [ a ]; // array of arrays
        return a;
    },
    
    clone = function(o) {
        var T = get_type( o ), T2;
        
        if ( !(T_OBJ_OR_ARRAY & T) ) return o;
        
        var co = {}, k;
        for (k in o) 
        {
            if ( o[HAS](k) && o[IS_ENUM](k) ) 
            { 
                T2 = get_type( o[k] );
                
                if (T_OBJ & T2)  co[k] = clone(o[k]);
                
                else if (T_STR_OR_ARRAY & T2)  co[k] = o[k].slice();
                
                else  co[k] = o[k]; 
            }
        }
        return co;
    },
    
    extend = function() {
        var args = arguments, argslen = args.length;
        
        if ( argslen<1 ) return null;
        else if ( argslen<2 ) return clone( args[0] );
        
        var o1 = args[0], o2, o = clone(o1), i, k, T; 
        argslen--;            
        
        for (i=1; i<argslen; i++)
        {
            o2 = args[i];
            if ( !o2 ) continue;
            
            for (k in o2) 
            { 
                if ( o2[HAS](k) && o2[IS_ENUM](k) )
                {
                    if ( o1[HAS](k) && o1[IS_ENUM](k) ) 
                    { 
                        T = get_type( o1[k] );
                        
                        if ( (T_OBJ & ~T_STR) & T)  o[k] = extend( o1[k], o2[k] );
                        
                        //else if (T_ARRAY == T)  o[k] = o1[k].slice();
                        
                        //else  o[k] = o1[k];
                    }
                    else
                    {
                        o[k] = clone( o2[k] );
                    }
                }
            }
        }
        return o;
    },
    
    escaped_re = /([.*+?^${}()|[\]\/\\\-])/g,
    escRegexp = function(str) {
        return str.replace(escaped_re, '\\$1');
    },
    
    replacement_re = /\$(\d{1,2})/g,
    groupReplace = function(pattern, token) {
        var parts, i, l, replacer;
        replacer = function(m, d){
            // the regex is wrapped in an additional group, 
            // add 1 to the requested regex group transparently
            return token[ 1 + parseInt(d, 10) ];
        };
        parts = pattern.split('$$');
        l = parts.length;
        for (i=0; i<l; i++) parts[i] = parts[i].replace(replacement_re, replacer);
        return parts.join('$');
    },
    
    trim_re = /^\s+|\s+$/g,
    trim = String[PROTO].trim
        ? function( s ){ return s.trim(); }
        : function( s ){ return s.replace(trim_re, ''); },
        
    byLength = function(a, b) { return b.length - a.length },
    
    newline_re = /\r\n|\r|\n/g,
    hasPrefix = function(s, id) {
        return (
            (T_STR & get_type(id)) && (T_STR & get_type(s)) && id.length &&
            id.length <= s.length && id == s.substr(0, id.length)
        );
    },
    
    getRegexp = function(r, rid, cachedRegexes)  {
        if ( !r || (T_NUM == get_type(r)) ) return r;
        
        var l = (rid) ? (rid.length||0) : 0, i;
        
        if ( l && rid == r.substr(0, l) ) 
        {
            var regexSource = r.substr(l), delim = regexSource[0], flags = '',
                regexBody, regexID, regex, chars, i, ch
            ;
            
            // allow regex to have delimiters and flags
            // delimiter is defined as the first character after the regexID
            i = regexSource.length;
            while ( i-- )
            {
                ch = regexSource[i];
                if (delim == ch) 
                    break;
                else if ('i' == ch.toLowerCase() ) 
                    flags = 'i';
            }
            regexBody = regexSource.substring(1, i);
            regexID = "^(" + regexBody + ")";
            //console.log([regexBody, flags]);
            
            if ( !cachedRegexes[ regexID ] )
            {
                regex = new RegExp( regexID, flags );
                /*chars = new RegexAnalyzer( regex ).peek();
                if ( null !== chars.peek && !Keys(chars.peek).length )  chars.peek = null;
                if ( null !== chars.negativepeek && !Keys(chars.negativepeek).length )  chars.negativepeek = null;*/
                // remove RegexAnalyzer dependency
                chars = {peek:null,negativepeek:null};
                
                // shared, light-weight
                cachedRegexes[ regexID ] = [ regex, chars ];
            }
            
            return cachedRegexes[ regexID ];
        }
        else
        {
            return r;
        }
    },
    
    getCombinedRegexp = function(tokens, boundary)  {
        var peek = { }, i, l, b = "", bT = get_type(boundary);
        if ( T_STR == bT || T_CHAR == bT ) b = boundary;
        var combined = tokens
                    .sort( byLength )
                    .map( function(t) {
                        peek[ t.charAt(0) ] = 1;
                        return escRegexp( t );
                    })
                    .join( "|" )
                ;
        return [ new RegExp("^(" + combined + ")"+b), { peek: peek, negativepeek: null }, 1 ];
    },
    
    _id_ = 0, 
    getId = function( ) { return ++_id_; },
    uuid = function( ns ) { return [ns||'uuid', ++_id_, new Date().getTime()].join('_'); },
    
    isNode = (typeof global !== "undefined" && toString.call(global) == '[object global]') ? 1 : 0,
    isBrowser = (!isNode && typeof navigator !== "undefined") ? 1 : 0, 
    isWorker = (typeof importScripts === "function" && navigator instanceof WorkerNavigator) ? 1 : 0,
    
    // Get current filename/path
    getCurrentPath = function() {
        var file = null, path, base, scripts;
        if ( isNode ) 
        {
            // http://nodejs.org/docs/latest/api/globals.html#globals_filename
            // this should hold the current file in node
            file = __filename;
            return { path: __dirname, file: __filename, base: __dirname };
        }
        else if ( isWorker )
        {
            // https://developer.mozilla.org/en-US/docs/Web/API/WorkerLocation
            // this should hold the current url in a web worker
            file = self.location.href;
        }
        else if ( isBrowser )
        {
            // get last script (should be the current one) in browser
            base = document.location.href.split('#')[0].split('?')[0].split('/').slice(0, -1).join('/');
            if ((scripts = document.getElementsByTagName('script')) && scripts.length) 
                file = scripts[scripts.length - 1].src;
        }
        
        if ( file )
            return { path: file.split('/').slice(0, -1).join('/'), file: file, base: base };
        return { path: null, file: null, base: null };
    },
    thisPath = getCurrentPath()
;

//
// Stream Class
var Max = Math.max, spcRegex = /^[\s\u00a0]+/, spc = /[^\s\u00a0]/;

// a wrapper-class to manipulate a string as a stream, based on Codemirror's StringStream
function Stream( line ) 
{
    var self = this;
    self._ = null;
    self.s = line ? ''+line : '';
    self.start = self.pos = 0;
    self.lCP = self.lCV = 0;
    self.lS = 0;
}

// Counts the column offset in a string, taking tabs into account.
// Used mostly to find indentation.
// adapted from CodeMirror
Stream.col = function( string, end, tabSize, startIndex, startValue ) {
    var i, n;
    if ( null === end ) 
    {
        end = string.search( spc );
        if ( -1 == end ) end = string.length;
    }
    for (i = startIndex || 0, n = startValue || 0; i < end; ++i) 
        n += ( "\t" == string.charAt(i) ) ? (tabSize - (n % tabSize)) : 1;
    return n;
};
    
// new Stream from another stream
Stream._ = function( _ ) {
    var stream = new Stream( );
    stream._ = _;
    stream.s = ''+_.string;
    stream.start = _.start;
    stream.pos = _.pos;
    stream.lCP = _.lastColumnPos;
    stream.lCV = _.lastColumnValue;
    stream.lS = _.lineStart;
    return stream;
};

Stream[PROTO] = {
     constructor: Stream
    
    // abbreviations used for optimal minification
    ,_: null
    ,s: ''
    ,start: 0
    ,pos: 0
    // last column pos
    ,lCP: 0
    // last column value
    ,lCV: 0
    // line start
    ,lS: 0
    
    ,dispose: function( ) {
        var self = this;
        self._ = null;
        self.s = null;
        self.start = null;
        self.pos = null;
        self.lCP = null;
        self.lCV = null;
        self.lS = null;
        return self;
    }
    
    ,toString: function( ) { 
        return this.s; 
    }
    
    // string start-of-line?
    ,sol: function( ) { 
        return 0 === this.pos; 
    }
    
    // string end-of-line?
    ,eol: function( ) { 
        return this.pos >= this.s.length; 
    }
    
    // char match
    ,chr: function( pattern, eat ) {
        var self = this, ch = self.s.charAt(self.pos) || null;
        if (ch && pattern === ch) 
        {
            if (false !== eat) 
            {
                self.pos += 1;
                if ( self._ ) self._.pos = self.pos;
            }
            return ch;
        }
        return false;
    }
    
    // char list match
    ,chl: function( pattern, eat ) {
        var self = this, ch = self.s.charAt(self.pos) || null;
        if ( ch && (-1 < pattern.indexOf( ch )) ) 
        {
            if (false !== eat) 
            {
                self.pos += 1;
                if ( self._ ) self._.pos = self.pos;
            }
            return ch;
        }
        return false;
    }
    
    // string match
    ,str: function( pattern, startsWith, eat ) {
        var self = this, len, pos = self.pos, str = self.s, ch = str.charAt(pos) || null;
        if ( ch && startsWith[ ch ] )
        {
            len = pattern.length; 
            if ( pattern === str.substr(pos, len) ) 
            {
                if (false !== eat) 
                {
                    self.pos += len;
                    if ( self._ ) self._.pos = self.pos;
                }
                return pattern;
            }
        }
        return false;
    }
    
    // regex match
    ,rex: function( pattern, startsWith, notStartsWith, group, eat ) {
        var self = this, match, pos = self.pos, str = self.s, ch = str.charAt(pos) || null;
        // remove RegexAnalyzer dependency
        /*if ( ch && ( startsWith && startsWith[ ch ] ) || ( notStartsWith && !notStartsWith[ ch ] ) )
        {*/
            match = str.slice( pos ).match( pattern );
            if (!match || match.index > 0) return false;
            if ( false !== eat ) 
            {
                self.pos += match[group||0].length;
                if ( self._ ) self._.pos = self.pos;
            }
            return match;
        /*}
        return false;*/
    }

    // eat space
    ,spc: function( eat ) {
        var self = this, m, start = self.pos, s = self.s.slice(start);
        if ( m = s.match( spcRegex ) ) 
        {
            if ( false !== eat )
            {
                self.pos += m[0].length;
                if ( self._ ) self._.pos = self.pos;
            }
            return 1;
        }
        return 0;
    }
    
    // skip to end
    ,end: function( ) {
        var self = this;
        self.pos = self.s.length;
        if ( self._ ) self._.pos = self.pos;
        return self;
    }

    // get next char
    ,nxt: function( ) {
        var self = this, ch, s = self.s;
        if (self.pos < s.length)
        {
            ch = s.charAt(self.pos++) || null;
            if ( self._ ) self._.pos = self.pos;
            return ch;
        }
    }
    
    // back-up n steps
    ,bck: function( n ) {
        var self = this;
        self.pos = Max(0, self.pos - n);
        if ( self._ ) self._.pos = self.pos;
        return self;
    }
    
    // back-track to pos
    ,bck2: function( pos ) {
        var self = this;
        self.pos = Max(0, pos);
        if ( self._ ) self._.pos = self.pos;
        return self;
    }
    
    // get current column including tabs
    ,col: function( tabSize ) {
        var self = this;
        tabSize = tabSize || 1;
        if (self.lCP < self.start) 
        {
            self.lCV = Stream.col(self.s, self.start, tabSize, self.lCP, self.lCV);
            self.lCP = self.start;
            if ( self._ )
            {
                self._.start = self.start;
                self._.lastColumnPos = self.lCP;
                self._.lastColumnValue = self.lCV;
                self._.lineStart = self.lS;
            }
        }
        return self.lCV - (self.lS ? Stream.col(self.s, self.lS, tabSize) : 0);
    }
    
    // get current indentation including tabs
    ,ind: function( tabSize ) {
        var self = this;
        tabSize = tabSize || 1;
        return Stream.col(self.s, null, tabSize) - (self.lS ? Stream.col(self.s, self.lS, tabSize) : 0);
    }
    
    // current stream selection
    ,cur: function( andShiftStream ) {
        var self = this, ret = self.s.slice(self.start, self.pos);
        if ( andShiftStream ) self.start = self.pos;
        return ret;
    }
    
    // move/shift stream
    ,sft: function( ) {
        this.start = this.pos;
        return this;
    }
};

//
// Stack Class
function Stack( array ) 
{
    this._ = array || [];
}
Stack[PROTO] = {
     constructor: Stack
    
    // abbreviations used for optimal minification
    ,_: null
    
    ,dispose: function( ) {
        var self = this;
        self._ = null;
        return self;
    }
    
    ,toString: function( ) { 
        return this._.slice( ).reverse( ).join( "\n" ); 
    }
    
    ,clone: function( ) {
        return new Stack( this._.slice( ) );
    }
    
    ,isEmpty: function( ) {
        return 0 >= this._.length;
    }
    
    ,pos: function( ) {
        return this._.length;
    }
    
    ,peek: function( index ) {
        var self = this, stack = self._;
        index = !arguments.length ? -1 : index;
        if ( stack.length )
        {
            if ( (0 > index) && (0 <= stack.length+index) )
                return stack[ stack.length + index ];
            else if ( 0 <= index && index < stack.length )
                return stack[ index ];
        }
        return null;
    }
    
    ,pop: function( ) {
        return this._.pop( );
    }
    
    ,shift: function( ) {
        return this._.shift( );
    }
    
    ,push: function( i ) {
        var self = this;
        self._.push( i );
        return self;
    }
    
    ,unshift: function( i ) {
        var self = this;
        self._.unshift( i );
        return self;
    }
    
    ,pushAt: function( pos, token, idProp, id ) {
        var self = this, stack = self._;
        if ( idProp && id ) token[idProp] = id;
        if ( pos < stack.length ) stack.splice( pos, 0, token );
        else stack.push( token );
        return self;
    }
    
    ,empty: function( idProp, id ) {
        var self = this, stack = self._, l = stack.length;
        if ( idProp && id )
        {
            //while (l && stack[l-1] && stack[l-1][idProp] == id) 
            while ( stack.length && stack[stack.length-1] && stack[stack.length-1][idProp] === id ) 
            {
                //console.log([id, stack[l-1][idProp]]);
                //--l;
                stack.pop();
            }
            //stack.length = l;
        }
        else stack.length = 0;
        return self;
    }
};

//
// State Class
function State( line, unique ) 
{
    var self = this;
    // this enables unique state "names"
    // thus forces highlight to update
    // however updates also occur when no update necessary ??
    self.id = unique ? uuid("state") : "state";
    self.l = line || 0;
    self.stack = new Stack( );
    self.data = new Stack( );
    self.col = 0;
    self.indent = 0;
    self.t = null;
    self.inBlock = null;
    self.endBlock = null;
}
State[PROTO] = {
     constructor: State
    
    // state id
    ,id: null
    // state current line
    ,l: 0
    ,col: 0
    ,indent: 0
    // state token stack
    ,stack: null
    // state token push/pop match data
    ,data: null
    // state current token
    ,t: null
    // state current block name
    ,inBlock: null
    // state endBlock for current block
    ,endBlock: null
    
    ,dispose: function( ) {
        var self = this;
        if ( self.stack ) self.stack.dispose( );
        if ( self.data ) self.data.dispose( );
        self.stack = null;
        self.data = null;
        self.id = null;
        self.t = null;
        self.l = null;
        self.col = null;
        self.indent = null;
        self.inBlock = null;
        self.endBlock = null;
        return self;
    }
    
    ,clone: function( unique ) {
        var self = this, c = new State( self.l, unique );
        c.t = self.t;
        c.col = self.col;
        c.indent = self.indent;
        c.stack = self.stack.clone( );
        c.data = self.data.clone( );
        c.inBlock = self.inBlock;
        c.endBlock = self.endBlock;
        return c;
    }
    
    // used mostly for ACE which treats states as strings, 
    // make sure to generate a string which will cover most cases where state needs to be updated by the editor
    ,toString: function() {
        var self = this;
        //return ['', self.id, self.inBlock||'0'].join('_');
        //return ['', self.id, self.t, self.r||'0', self.stack.length, self.inBlock||'0'].join('_');
        //return ['', self.id, self.t, self.stack.length, self.inBlock||'0'].join('_');
        //return ['', self.id, self.t, self.r||'0', self.inBlock||'0'].join('_');
        //return ['', self.l, self.t, self.r, self.inBlock||'0', self.stack.length].join('_');
        return ['', self.id, self.l, self.t, self.inBlock||'0'].join('_');
    }
};

//
// matcher factories
var getChar = function( stream, eat ) {
        var self = this, matchedResult;    
        if ( matchedResult = stream.chr( self.tp, eat ) ) return [ self.tk, matchedResult ];
        return false;
    },
    
    getCharList = function( stream, eat ) {
        var self = this, matchedResult;    
        if ( matchedResult = stream.chl( self.tp, eat ) ) return [ self.tk, matchedResult ];
        return false;
    },
    
    getStr = function( stream, eat ) {
        var self = this, matchedResult;    
        if ( matchedResult = stream.str( self.tp, self.p, eat ) ) return [ self.tk, matchedResult ];
        return false;
    },
    
    getRegex = function( stream, eat ) {
        var self = this, matchedResult;    
        if ( matchedResult = stream.rex( self.tp, self.p, self.np, self.tg, eat ) ) return [ self.tk, matchedResult ];
        return false;
    },
    
    getNull = function( stream, eat ) {
        var self = this;
        // matches end-of-line
        (false !== eat) && stream.end( ); // skipToEnd
        return [ self.tk, "" ];
    }
;
    
function SimpleMatcher( type, name, pattern, key ) 
{
    var self = this;
    self.$class = SimpleMatcher;
    self.mt = T_SIMPLEMATCHER;
    self.tt = type || T_CHAR;
    self.tn = name;
    self.tk = key || 0;
    self.tg = 0;
    self.tp = null;
    self.p = null;
    self.np = null;
    
    // get a fast customized matcher for < pattern >
    switch ( self.tt )
    {
        case T_CHAR: case T_CHARLIST:
            self.tp = pattern;
            self.get = T_CHARLIST === self.tt ? getCharList : getChar;
            break;
        case T_STR:
            self.tp = pattern;
            self.p = {};
            self.p[ '' + pattern.charAt(0) ] = 1;
            self.get = getStr;
            break;
        case T_REGEX:
            self.tp = pattern[ 0 ];
            self.p = pattern[ 1 ].peek || null;
            self.np = pattern[ 1 ].negativepeek || null;
            self.tg = pattern[ 2 ] || 0;
            self.get = getRegex;
            break;
        case T_NULL:
            self.tp = null;
            self.get = getNull;
            break;
    }
}
SimpleMatcher[PROTO] = {
     constructor: SimpleMatcher
    
    ,$class: null
    // matcher type
    ,mt: null
    // token type
    ,tt: null
    // token name
    ,tn: null
    // token pattern
    ,tp: null
    // token pattern group
    ,tg: 0
    // token key
    ,tk: 0
    // pattern peek chars
    ,p: null
    // pattern negative peek chars
    ,np: null
    
    ,get: function( stream, eat ) {
        return false;
    }
    
    ,toString: function() {
        var self = this;
        return [
            '[', 'Matcher: ', 
            self.tn, 
            ', Pattern: ', 
            (self.tp ? self.tp.toString() : null), 
            ']'
        ].join('');
    }
};
    
function CompositeMatcher( name, matchers, useOwnKey ) 
{
    var self = this;
    self.$class = CompositeMatcher;
    self.mt = T_COMPOSITEMATCHER;
    self.tn = name;
    self.ms = matchers;
    self.ownKey = (false!==useOwnKey);
}
// extends SimpleMatcher
CompositeMatcher[PROTO] = Merge(Extend(SimpleMatcher[PROTO]), {
     constructor: CompositeMatcher
    
    // group of matchers
    ,ms: null
    ,ownKey: true
    
    ,get: function( stream, eat ) {
        var self = this, i, m, matchers = self.ms, l = matchers.length, useOwnKey = self.ownKey;
        for (i=0; i<l; i++)
        {
            // each one is a matcher in its own
            m = matchers[ i ].get( stream, eat );
            if ( m ) return useOwnKey ? [ i, m[1] ] : m;
        }
        return false;
    }
});
    
function BlockMatcher(name, start, end) 
{
    var self = this;
    self.$class = BlockMatcher;
    self.mt = T_BLOCKMATCHER;
    self.tn = name;
    self.s = new CompositeMatcher( self.tn + '_Start', start, false );
    self.e = end;
}
// extends SimpleMatcher
BlockMatcher[PROTO] = Merge(Extend(SimpleMatcher[PROTO]), {
     constructor: BlockMatcher
    // start block matcher
    ,s: null
    // end block matcher
    ,e: null
    
    ,get: function( stream, eat ) {
        var self = this, startMatcher = self.s, endMatchers = self.e, token;
        
        // matches start of block using startMatcher
        // and returns the associated endBlock matcher
        if ( token = startMatcher.get( stream, eat ) )
        {
            // use the token key to get the associated endMatcher
            var endMatcher = endMatchers[ token[0] ], m, 
                T = get_type( endMatcher ), T0 = startMatcher.ms[ token[0] ].tt;
            
            if ( T_REGEX === T0 )
            {
                // regex group number given, get the matched group pattern for the ending of this block
                if ( T_NUM === T )
                {
                    // the regex is wrapped in an additional group, 
                    // add 1 to the requested regex group transparently
                    m = token[1][ endMatcher+1 ];
                    endMatcher = new SimpleMatcher( (m.length > 1) ? T_STR : T_CHAR, self.tn + '_End', m );
                }
                // string replacement pattern given, get the proper pattern for the ending of this block
                else if ( T_STR === T )
                {
                    // the regex is wrapped in an additional group, 
                    // add 1 to the requested regex group transparently
                    m = groupReplace(endMatcher, token[1]);
                    endMatcher = new SimpleMatcher( (m.length > 1) ? T_STR : T_CHAR, self.tn + '_End', m );
                }
            }
            return endMatcher;
        }
        
        return false;
    }
});

function getSimpleMatcher( name, pattern, key, cachedMatchers ) 
{
    var T = get_type( pattern );
    
    if ( T_NUM === T ) return pattern;
    
    if ( !cachedMatchers[ name ] )
    {
        key = key || 0;
        var matcher, is_char_list = 0;
        
        if ( pattern && pattern.isCharList )
        {
            is_char_list = 1;
            delete pattern.isCharList;
        }
        
        // get a fast customized matcher for < pattern >
        if ( T_NULL & T ) matcher = new SimpleMatcher( T_NULL, name, pattern, key );
        
        else if ( T_CHAR === T ) matcher = new SimpleMatcher( T_CHAR, name, pattern, key );
        
        else if ( T_STR & T ) matcher = (is_char_list) ? new SimpleMatcher( T_CHARLIST, name, pattern, key ) : new SimpleMatcher( T_STR, name, pattern, key );
        
        else if ( /*T_REGEX*/T_ARRAY & T ) matcher = new SimpleMatcher( T_REGEX, name, pattern, key );
        
        // unknown
        else matcher = pattern;
        
        cachedMatchers[ name ] = matcher;
    }
    
    return cachedMatchers[ name ];
}

function getCompositeMatcher( name, tokens, RegExpID, combined, cachedRegexes, cachedMatchers ) 
{
    if ( !cachedMatchers[ name ] )
    {
        var tmp, i, l, l2, array_of_arrays = 0, 
            has_regexs = 0, is_char_list = 1, 
            T1, T2, matcher
        ;
        
        tmp = make_array( tokens );
        l = tmp.length;
        
        if ( 1 == l )
        {
            matcher = getSimpleMatcher( name, getRegexp( tmp[0], RegExpID, cachedRegexes ), 0, cachedMatchers );
        }
        else if ( 1 < l /*combined*/ )
        {   
            l2 = (l>>1) + 1;
            // check if tokens can be combined in one regular expression
            // if they do not contain sub-arrays or regular expressions
            for (i=0; i<=l2; i++)
            {
                T1 = get_type( tmp[i] );
                T2 = get_type( tmp[l-1-i] );
                
                if ( (T_CHAR !== T1) || (T_CHAR !== T2) ) 
                {
                    is_char_list = 0;
                }
                
                if ( (T_ARRAY & T1) || (T_ARRAY & T2) ) 
                {
                    array_of_arrays = 1;
                    //break;
                }
                else if ( hasPrefix( tmp[i], RegExpID ) || hasPrefix( tmp[l-1-i], RegExpID ) )
                {
                    has_regexs = 1;
                    //break;
                }
            }
            
            if ( is_char_list && ( !combined || !( T_STR & get_type(combined) ) ) )
            {
                tmp = tmp.slice().join('');
                tmp.isCharList = 1;
                matcher = getSimpleMatcher( name, tmp, 0, cachedMatchers );
            }
            else if ( combined && !(array_of_arrays || has_regexs) )
            {   
                matcher = getSimpleMatcher( name, getCombinedRegexp( tmp, combined ), 0, cachedMatchers );
            }
            else
            {
                for (i=0; i<l; i++)
                {
                    if ( T_ARRAY & get_type( tmp[i] ) )
                        tmp[i] = getCompositeMatcher( name + '_' + i, tmp[i], RegExpID, combined, cachedRegexes, cachedMatchers );
                    else
                        tmp[i] = getSimpleMatcher( name + '_' + i, getRegexp( tmp[i], RegExpID, cachedRegexes ), i, cachedMatchers );
                }
                
                matcher = (l > 1) ? new CompositeMatcher( name, tmp ) : tmp[0];
            }
        }
        
        cachedMatchers[ name ] = matcher;
    }
    
    return cachedMatchers[ name ];
}

function getBlockMatcher( name, tokens, RegExpID, cachedRegexes, cachedMatchers ) 
{
    if ( !cachedMatchers[ name ] )
    {
        var tmp, i, l, start, end, t1, t2;
        
        // build start/end mappings
        start = []; end = [];
        tmp = make_array_2( tokens ); // array of arrays
        for (i=0, l=tmp.length; i<l; i++)
        {
            t1 = getSimpleMatcher( name + '_0_' + i, getRegexp( tmp[i][0], RegExpID, cachedRegexes ), i, cachedMatchers );
            if (tmp[i].length>1)
            {
                if ( T_REGEX === t1.tt && T_STR === get_type( tmp[i][1] ) && !hasPrefix( tmp[i][1], RegExpID ) )
                    t2 = tmp[i][1];
                else
                    t2 = getSimpleMatcher( name + '_1_' + i, getRegexp( tmp[i][1], RegExpID, cachedRegexes ), i, cachedMatchers );
            }
            else
            {
                t2 = t1;
            }
            start.push( t1 );  end.push( t2 );
        }
        
        cachedMatchers[ name ] = new BlockMatcher( name, start, end );
    }
    
    return cachedMatchers[ name ];
}


//
// tokenizer factories
var ACTION_PUSH = 1, ACTION_POP = 2/*,
    
    getEMPTY = function( stream, state ) {
        var self = this;
        
        self.MTCH = 0;
        // match EMPTY token
        self.ERR = 0;
        self.REQ = 0;
        return true;
    },
    
    getEOL = function( stream, state ) {
        var self = this;
        
        self.MTCH = 0;
        // match EOL ( with possible leading spaces )
        stream.spc( );
        if ( stream.eol( ) )  return self.id; 
        return false;
    },
    
    getNONSPC = function( stream, state ) {
        var self = this;
        
        self.MTCH = 0;
        // match non-space
        self.ERR = ( self.REQ && stream.spc( ) && !stream.eol( ) ) ? 1 : 0;
        self.REQ = 0;
        return false;
    },
    
    getTOKEN = function( stream, state ) {
        var self = this, t = null;
        
        self.MTCH = 0;
        // else match a simple token
        if ( t = self.tk.get( stream ) ) 
        { 
            if ( self.ta ) self.MTCH = self.act( t, state );
            return self.id; 
        }
        return false;
    }*/
;
    
function SimpleToken( type, name, token ) 
{
    var self = this;
    self.$class = SimpleToken;
    self.tt = type || T_SIMPLE;
    self.id = name;
    self.tk = token;
    self.REQ = 0;
    self.ERR = 0;
    self.MTCH = 0;
    self.CLONE = ['tk'];
}
SimpleToken[PROTO] = {
     constructor: SimpleToken
    
    ,$class: null
    ,sID: null
    // tokenizer/token name/id
    ,id: null
    // tokenizer type
    ,tt: null
    // tokenizer token matcher
    ,tk: null
    // tokenizer match action (optional)
    ,ta: null
    ,REQ: 0
    ,ERR: 0
    ,MTCH: 0
    ,CLONE: null
    
    // tokenizer match action (optional)
    ,act: function( token, state ) {
        var matchAction = this.ta || null, t, T, data = state.data;
        
        if ( matchAction )
        {
            t = matchAction[1];
            
            if ( ACTION_PUSH === matchAction[0] && t )
            {
                if ( token )
                {
                    T = get_type( t );
                    if ( T_NUM === T )  t = token[1][t];
                    else t = groupReplace( t, token[1] );
                }
                data.push( t );
            }
            
            else if ( ACTION_POP ===  matchAction[0] )
            {
                if ( t )
                {
                    if ( token )
                    {
                        T = get_type( t );
                        if ( T_NUM == T )  t = token[1][t];
                        else t = groupReplace( t, token[1] );
                    }
                    
                    if ( data.isEmpty( ) || t !== data.peek( ) ) return t;
                    data.pop( );
                }
                else if ( data.length ) data.pop( );
            }
        }
        return 0;
    }
    
    ,get: function( stream, state ) {
        var self = this, matchAction = self.tm, token = self.tk, 
            type = self.tt, tokenID = self.id, t = null;
        
        self.MTCH = 0;
        // match EMPTY token
        if ( T_EMPTY === type ) 
        { 
            self.ERR = 0;
            self.REQ = 0;
            return true;
        }
        // match EOL ( with possible leading spaces )
        else if ( T_EOL === type ) 
        { 
            stream.spc();
            if ( stream.eol() )
            {
                return tokenID; 
            }
        }
        // match non-space
        else if ( T_NONSPACE === type ) 
        { 
            self.ERR = ( self.REQ && stream.spc() && !stream.eol() ) ? 1 : 0;
            self.REQ = 0;
        }
        // else match a simple token
        else if ( t = token.get(stream) ) 
        { 
            if ( matchAction ) self.MTCH = self.act(t, state);
            return tokenID; 
        }
        return false;
    }
    
    ,req: function( bool ) { 
        this.REQ = !!bool;
        return this;
    }
    
    ,err: function( ) {
        var t = this;
        if ( t.REQ ) return 'Token "'+t.id+'" Expected';
        else if ( t.MTCH ) return 'Token "'+t.MTCH+'" No Match'
        return 'Syntax Error: "'+t.id+'"';
    }

    ,clone: function( ) {
        var self = this, t, i, toClone = self.CLONE, toClonelen;
        
        t = new self.$class( );
        t.tt = self.tt;
        t.id = self.id;
        t.tm = self.tm ? self.tm.slice() : self.tm;
        
        if ( toClone && toClone.length )
        {
            for (i=0, toClonelen = toClone.length; i<toClonelen; i++)   
                t[ toClone[i] ] = self[ toClone[i] ];
        }
        return t;
    }
    
    ,toString: function( ) {
        var self = this;
        return [
            '[', 'Tokenizer: ', 
            self.id, 
            ', Matcher: ', 
            (self.tk ? self.tk.toString() : null), 
            ']'
        ].join('');
    }
};
    
function BlockToken( type, name, token, allowMultiline, escChar, hasInterior ) 
{
    var self = this;
    self.$class = BlockToken;
    self.tt = type;
    self.id = name;
    self.tk = token;
    self.REQ = 0;
    self.ERR = 0;
    self.MTCH = 0;
    // a block is multiline by default
    self.mline = 'undefined' === typeof(allowMultiline) ? 1 : allowMultiline;
    self.esc = escChar || "\\";
    self.inter = hasInterior;
    self.CLONE = ['tk', 'mline', 'esc', 'inter'];
}
// extends SimpleToken
BlockToken[PROTO] = Merge(Extend(SimpleToken[PROTO]), {
     constructor: BlockToken
     
    ,inter: 0
    ,mline: 0
    ,esc: null
    
    ,get: function( stream, state ) {
        var self = this, ended = 0, found = 0, endBlock, next = "", continueToNextLine, stackPos, 
            allowMultiline = self.mline, startBlock = self.tk, thisBlock = self.id, type = self.tt,
            hasInterior = self.inter, thisBlockInterior = (hasInterior) ? (thisBlock+'.inside') : thisBlock,
            charIsEscaped = 0, isEscapedBlock = T_ESCBLOCK === type, escChar = self.esc,
            isEOLBlock, alreadyIn, ret, streamPos, streamPos0, continueBlock
        ;
        
        /*
            This tokenizer class handles many different block types ( BLOCK, COMMENT, ESC_BLOCK, SINGLE_LINE_BLOCK ),
            having different styles ( DIFFERENT BLOCK DELIMS/INTERIOR ) etc..
            So logic can become somewhat complex,
            descriptive names and logic used here for clarity as far as possible
        */
        
        // comments in general are not required tokens
        if ( T_COMMENT === type ) self.REQ = 0;
        
        alreadyIn = 0;
        if ( state.inBlock === thisBlock )
        {
            found = 1;
            endBlock = state.endBlock;
            alreadyIn = 1;
            ret = thisBlockInterior;
        }    
        else if ( !state.inBlock && (endBlock = startBlock.get(stream)) )
        {
            found = 1;
            state.inBlock = thisBlock;
            state.endBlock = endBlock;
            ret = thisBlock;
        }    
        
        if ( found )
        {
            stackPos = state.stack.pos( );
            
            isEOLBlock = (T_NULL === endBlock.tt);
            
            if ( hasInterior )
            {
                if ( alreadyIn && isEOLBlock && stream.sol( ) )
                {
                    self.REQ = 0;
                    state.inBlock = null;
                    state.endBlock = null;
                    return false;
                }
                
                if ( !alreadyIn )
                {
                    state.stack.pushAt( stackPos, self.clone( ), 'sID', thisBlock );
                    return ret;
                }
            }
            
            ended = endBlock.get( stream );
            continueToNextLine = allowMultiline;
            continueBlock = 0;
            
            if ( !ended )
            {
                streamPos0 = stream.pos;
                while ( !stream.eol( ) ) 
                {
                    streamPos = stream.pos;
                    if ( !(isEscapedBlock && charIsEscaped) && endBlock.get(stream) ) 
                    {
                        if ( hasInterior )
                        {
                            if ( stream.pos > streamPos && streamPos > streamPos0 )
                            {
                                ret = thisBlockInterior;
                                stream.bck2(streamPos);
                                continueBlock = 1;
                            }
                            else
                            {
                                ret = thisBlock;
                                ended = 1;
                            }
                        }
                        else
                        {
                            ret = thisBlock;
                            ended = 1;
                        }
                        break;
                    }
                    else
                    {
                        next = stream.nxt( );
                    }
                    charIsEscaped = !charIsEscaped && next == escChar;
                }
            }
            else
            {
                ret = (isEOLBlock) ? thisBlockInterior : thisBlock;
            }
            continueToNextLine = allowMultiline || (isEscapedBlock && charIsEscaped);
            
            if ( ended || (!continueToNextLine && !continueBlock) )
            {
                state.inBlock = null;
                state.endBlock = null;
            }
            else
            {
                state.stack.pushAt( stackPos, self.clone( ), 'sID', thisBlock );
            }
            
            return ret;
        }
        
        //state.inBlock = null;
        //state.endBlock = null;
        return false;
    }
});
            
function RepeatedTokens( type, name, tokens, min, max ) 
{
    var self = this;
    self.$class = RepeatedTokens;
    self.tt = type || T_REPEATED;
    self.id = name || null;
    self.tk = null;
    self.ts = null;
    self.min = min || 0;
    self.max = max || INF;
    self.found = 0;
    self.CLONE = ['ts', 'min', 'max', 'found'];
    if ( tokens ) self.set( tokens );
}
// extends SimpleToken
RepeatedTokens[PROTO] = Merge(Extend(SimpleToken[PROTO]), {
     constructor: RepeatedTokens
     
    ,ts: null
    ,min: 0
    ,max: 1
    ,found: 0
    
    ,set: function( tokens ) {
        if ( tokens ) this.ts = make_array( tokens );
        return this;
    }
    
    ,get: function( stream, state ) {
        var self = this, i, token, style, tokens = self.ts, n = tokens.length, 
            found = self.found, min = self.min, max = self.max,
            tokensRequired = 0, streamPos, stackPos, stackId;
        
        self.ERR = 0;
        self.REQ = 0;
        self.MTCH = 0;
        streamPos = stream.pos;
        stackPos = state.stack.pos( );
        stackId = self.id+'_'+getId( );
        
        for (i=0; i<n; i++)
        {
            token = tokens[i].clone( ).req( 1 );
            style = token.get( stream, state );
            
            if ( false !== style )
            {
                ++found;
                if ( found <= max )
                {
                    // push it to the stack for more
                    self.found = found;
                    state.stack.pushAt( stackPos, self.clone( ), 'sID', stackId );
                    self.found = 0;
                    self.MTCH = token.MTCH;
                    return style;
                }
                break;
            }
            else if ( token.REQ )
            {
                tokensRequired++;
            }
            if ( token.ERR ) stream.bck2( streamPos );
        }
        
        self.REQ = found < min;
        self.ERR = found > max || (found < min && 0 < tokensRequired);
        return false;
    }
});
    
function EitherTokens( type, name, tokens ) 
{
    RepeatedTokens.call(this, type, name, tokens, 1, 1);
    this.$class = EitherTokens;
}
// extends RepeatedTokens
EitherTokens[PROTO] = Merge(Extend(RepeatedTokens[PROTO]), {
     constructor: EitherTokens
     
    ,get: function( stream, state ) {
        var self = this, style, token, i, tokens = self.ts, n = tokens.length, 
            tokensRequired = 0, tokensErr = 0, streamPos;
        
        self.REQ = 1;
        self.ERR = 0;
        self.MTCH = 0;
        streamPos = stream.pos;
        
        for (i=0; i<n; i++)
        {
            token = tokens[i].clone().req( 1 );
            style = token.get(stream, state);
            
            tokensRequired += (token.REQ) ? 1 : 0;
            
            if ( false !== style )
            {
                self.MTCH = token.MTCH;
                return style;
            }
            else if ( token.ERR )
            {
                tokensErr++;
                stream.bck2( streamPos );
            }
        }
        
        self.REQ = (tokensRequired > 0);
        self.ERR = (n == tokensErr && tokensRequired > 0);
        return false;
    }
});

function AllTokens( type, name, tokens ) 
{
    RepeatedTokens.call(this, type, name, tokens, 1, 1);
    this.$class = AllTokens;
}
// extends RepeatedTokens
AllTokens[PROTO] = Merge(Extend(RepeatedTokens[PROTO]), {
     constructor: AllTokens
    
    ,get: function( stream, state ) {
        var self = this, token, style, tokens = self.ts, n = tokens.length,
            streamPos, stackPos, stackId;
        
        self.REQ = 1;
        self.ERR = 0;
        self.MTCH = 0;
        streamPos = stream.pos;
        stackPos = state.stack.pos();
        token = tokens[ 0 ].clone().req( 1 );
        style = token.get(stream, state);
        stackId = self.id+'_'+getId();
        
        if ( false !== style )
        {
            // not empty token
            if ( true !== style )
            {
                for (var i=n-1; i>0; i--)
                    state.stack.pushAt( stackPos+n-i-1, tokens[ i ].clone().req( 1 ), 'sID', stackId );
            }
                
            self.MTCH = token.MTCH;
            return style;
        }
        else if ( token.ERR /*&& token.REQ*/ )
        {
            self.ERR = 1;
            stream.bck2( streamPos );
        }
        else if ( token.REQ )
        {
            self.ERR = 1;
        }
        
        return false;
    }
});
            
function NGramToken( type, name, tokens ) 
{
    RepeatedTokens.call(this, type, name, tokens, 1, 1);
    this.$class = NGramToken;
}
// extends RepeatedTokens
NGramToken[PROTO] = Merge(Extend(RepeatedTokens[PROTO]), {
     constructor: NGramToken
     
    ,get: function( stream, state ) {
        var self = this, token, style, tokens = self.ts, n = tokens.length, 
            streamPos, stackPos, stackId, i;
        
        self.REQ = 0;
        self.ERR = 0;
        self.MTCH = 0;
        streamPos = stream.pos;
        stackPos = state.stack.pos();
        token = tokens[ 0 ].clone().req( 0 );
        style = token.get(stream, state);
        stackId = self.id+'_'+getId();
        
        if ( false !== style )
        {
            // not empty token
            if ( true !== style )
            {
                for (i=n-1; i>0; i--)
                    state.stack.pushAt( stackPos+n-i-1, tokens[ i ].clone().req( 1 ), 'sID', stackId );
            }
            
            self.MTCH = token.MTCH;
            return style;
        }
        else if ( token.ERR )
        {
            stream.bck2( streamPos );
        }
        
        return false;
    }
});

var dashes_re = /[\-_]/g;
function getTokenizer( tokenID, RegExpID, Lex, Syntax, Style, 
                    cachedRegexes, cachedMatchers, cachedTokens, 
                    commentTokens, comments, keywords ) 
{
    var tok, token = null, type, combine, matchAction, matchType, tokens, subTokenizers,
        ngrams, ngram, i, l, j, l2, xtends, xtendedTok, 
        t, modifier, tok_id, alternations, alternation, a, al;
    
    if ( null === tokenID )
    {
        // EOL Tokenizer
        return new SimpleToken( T_EOL, 'EOL', tokenID );
    }
    
    else if ( "" === tokenID )
    {
        // NONSPACE Tokenizer
        return new SimpleToken( T_NONSPACE, 'NONSPACE', tokenID );
    }
    
    else if ( false === tokenID || 0 === tokenID )
    {
        // EMPTY Tokenizer
        return new SimpleToken( T_EMPTY, 'EMPTY', tokenID );
    }
    
    else if ( T_ARRAY & get_type( tokenID ) )
    {
        // literal n-gram as array
        tok = {
            type: "ngram",
            tokens: tokenID
        };
        tokenID = tokenID.join("_");
        Syntax[ tokenID ] = tok;
    }
    
    tokenID = '' + tokenID;
    if ( cachedTokens[ tokenID ] ) return cachedTokens[ tokenID ];
    
    if ( Lex[ tokenID ] )
    {
        tok = Lex[ tokenID ];
        if ( T_STR_OR_ARRAY & get_type( tok ) )
        {
            // simple token given as literal token, wrap it
            tok = Lex[ tokenID ] = { type:"simple", tokens:tok };
        }
    }
    else if ( Syntax[ tokenID ] )
    {
        tok = Syntax[ tokenID ];
    }
    else
    {
        tok = tokenID;
    }
    
    if ( T_STR & get_type( tok ) )
    {
        t = tok;
        if ( 1 === t.length )
        {
            tok = Lex[ t ] = { type:"simple", tokens:t };
        }
        else
        {
            // shorthand notations for syntax groups
            alternations = t.split( ' | ' ).map( trim );
            al = alternations.length;
            if ( al > 1 )
            {
                // alternations, i.e: t1* | t2 | t3
                for (a=al-1; a>=0; a--)
                {
                    alternation = alternations[ a ];
                    if ( !alternation.length ) 
                    {
                        // empty token
                        alternations[ a ] = false;
                        continue;
                    }
                    if ( Lex[ alternation ] || Syntax[ alternation ] ) 
                    {
                        // subtoken is already defined
                        continue;
                    }
                    // check any modifiers
                    modifier = alternation.charAt( alternation.length-1 );
                    tok_id = alternation.slice( 0, -1 );
                    if ( Lex[ tok_id ] || Syntax[ tok_id ] )
                    {
                        if ( "*" === modifier ) // zero or more i.e: t*
                        {
                            Syntax[ alternation ] = { type:"group", match:"zeroOrMore", tokens:[tok_id] };
                        }
                        else if ( "+" === modifier ) // one or more i.e: t+
                        {
                            Syntax[ alternation ] = { type:"group", match:"oneOrMore", tokens:[tok_id] };
                        }
                        else if ( "?" === modifier ) // zero or one i.e: t?
                        {
                            Syntax[ alternation ] = { type:"group", match:"zeroOrOne", tokens:[tok_id] };
                        }
                        else if ( !Lex[ alternation ] && !Syntax[ alternation ] )
                        {
                            Lex[ alternation ] = { type:"simple", tokens:alternation };
                        }
                    }
                    else
                    {
                        // allow token to be literal and wrap to simple token with default style
                        Lex[ alternation ] = { type:"simple", tokens:alternation };
                    }
                }
                tok = Syntax[ t ] = { type:"group", match:"either", tokens:alternations };
            }
            else
            {
                modifier = t.charAt( t.length-1 );
                tok_id = t.slice( 0, -1 );
                if ( Lex[ tok_id ] || Syntax[ tok_id ] )
                {
                    if ( "*" === modifier ) // zero or more
                    {
                        tok = Syntax[ t ] = { type:"group", match:"zeroOrMore", tokens:[tok_id] };
                    }
                    else if ( "+" === modifier ) // one or more
                    {
                        tok = Syntax[ t ] = { type:"group", match:"oneOrMore", tokens:[tok_id] };
                    }
                    else if ( "?" === modifier ) // zero or one
                    {
                        tok = Syntax[ t ] = { type:"group", match:"zeroOrOne", tokens:[tok_id] };
                    }
                    else if ( !Lex[ t ] && !Syntax[ t ] )
                    {
                        tok = Lex[ t ] = { type:"simple", tokens:t };
                    }
                }
                else
                {
                    // allow token to be literal and wrap to simple token with default style
                    tok = Lex[ t ] = { type:"simple", tokens:t };
                }
            }
        }
    }
    
    // allow tokens to extend / reference other tokens
    while ( tok['extend'] )
    {
        xtends = tok['extend']; 
        xtendedTok = Lex[ xtends ] || Syntax[ xtends ];
        delete tok['extend'];
        if ( xtendedTok ) 
        {
            // tokens given directly, no token configuration object, wrap it
            if ( (T_STR | T_ARRAY) & get_type( xtendedTok ) )
            {
                xtendedTok = { type:"simple", tokens:xtendedTok };
            }
            tok = extend( xtendedTok, tok );
        }
        // xtendedTok may in itself extend another tok and so on,
        // loop and get all references
    }
    
    // provide some defaults
    if ( 'undefined' === typeof tok.type )
    {
        if ( tok['either'] )
        {
            tok.type = "group";
            tok.match = "either";
            tok.tokens = tok['either'];
            delete tok['either'];
        }
        else if ( tok['all'] || tok['sequence'] )
        {
            tok.type = "group";
            tok.match = "all";
            tok.tokens = tok['all'] || tok['sequence'];
            if ( tok['all'] ) delete tok['all'];
            else delete tok['sequence'];
        }
        else if ( tok['zeroOrMore'] )
        {
            tok.type = "group";
            tok.match = "zeroOrMore";
            tok.tokens = tok['zeroOrMore'];
            delete tok['zeroOrMore'];
        }
        else if ( tok['oneOrMore'] )
        {
            tok.type = "group";
            tok.match = "oneOrMore";
            tok.tokens = tok['oneOrMore'];
            delete tok['oneOrMore'];
        }
        else if ( tok['zeroOrOne'] )
        {
            tok.type = "group";
            tok.match = "zeroOrOne";
            tok.tokens = tok['zeroOrOne'];
            delete tok['zeroOrOne'];
        }
    }
    type = tok.type ? tokenTypes[ tok.type.toUpperCase( ).replace(dashes_re, '') ] : T_SIMPLE;
    
    if ( T_SIMPLE & type )
    {
        if ( "" === tok.tokens )
        {
            // NONSPACE Tokenizer
            token = new SimpleToken( T_NONSPACE, tokenID, tokenID );
            // pre-cache tokenizer to handle recursive calls to same tokenizer
            cachedTokens[ tokenID ] = token;
            return token;
        }
        else if ( null === tok.tokens )
        {
            // EOL Tokenizer
            token = new SimpleToken( T_EOL, tokenID, tokenID );
            // pre-cache tokenizer to handle recursive calls to same tokenizer
            cachedTokens[ tokenID ] = token;
            return token;
        }
        else if ( false === tok.tokens || 0 === tok.tokens )
        {
            // EMPTY Tokenizer
            token = new SimpleToken( T_EMPTY, tokenID, tokenID );
            // pre-cache tokenizer to handle recursive calls to same tokenizer
            cachedTokens[ tokenID ] = token;
            return token;
        }
    }

    tok.tokens = make_array( tok.tokens );
    
    if ( T_SIMPLE & type )
    {
        if ( tok.autocomplete ) getAutoComplete( tok, tokenID, keywords );
        
        matchAction = null;
        if ( tok.push )
        {
            matchAction = [ ACTION_PUSH, tok.push ];
        }
        else if  ( 'undefined' !== typeof( tok.pop ) )
        {
            matchAction = [ ACTION_POP, tok.pop ];
        }
        
        // combine by default if possible using word-boundary delimiter
        combine = ( 'undefined' === typeof(tok.combine) ) ? "\\b" : tok.combine;
        token = new SimpleToken( T_SIMPLE, tokenID,
                    getCompositeMatcher( tokenID, tok.tokens.slice(), RegExpID, combine, cachedRegexes, cachedMatchers )
                );
        token.ta = matchAction;
        // pre-cache tokenizer to handle recursive calls to same tokenizer
        cachedTokens[ tokenID ] = token;
    }
    
    else if ( T_BLOCK & type )
    {
        if ( T_COMMENT & type ) getComments( tok, comments );

        token = new BlockToken( type, tokenID,
                    getBlockMatcher( tokenID, tok.tokens.slice(), RegExpID, cachedRegexes, cachedMatchers ), 
                    tok.multiline,
                    tok.escape,
                    // allow block delims / block interior to have different styles
                    Style[ tokenID + '.inside' ] ? 1 : 0
                );
        
        // pre-cache tokenizer to handle recursive calls to same tokenizer
        cachedTokens[ tokenID ] = token;
        if ( tok.interleave ) commentTokens.push( token.clone( ) );
    }
    
    else if ( T_GROUP & type )
    {
        tokens = tok.tokens.slice( );
        if ( T_ARRAY & get_type( tok.match ) )
        {
            token = new RepeatedTokens( T_REPEATED, tokenID, null, tok.match[0], tok.match[1] );
        }
        else
        {
            matchType = groupTypes[ tok.match.toUpperCase() ]; 
            
            if ( T_ZEROORONE === matchType ) 
                token = new RepeatedTokens( T_ZEROORONE, tokenID, null, 0, 1 );
            
            else if ( T_ZEROORMORE === matchType ) 
                token = new RepeatedTokens( T_ZEROORMORE, tokenID, null, 0, INF );
            
            else if ( T_ONEORMORE === matchType ) 
                token = new RepeatedTokens( T_ONEORMORE, tokenID, null, 1, INF );
            
            else if ( T_EITHER & matchType ) 
                token = new EitherTokens( T_EITHER, tokenID, null );
            
            else //if (T_ALL === matchType)
                token = new AllTokens( T_ALL, tokenID, null );
        }
        
        // pre-cache tokenizer to handle recursive calls to same tokenizer
        cachedTokens[ tokenID ] = token;
        
        subTokenizers = [];
        for (i=0, l=tokens.length; i<l; i++)
            subTokenizers = subTokenizers.concat( getTokenizer( tokens[i], RegExpID, Lex, Syntax, Style, cachedRegexes, cachedMatchers, cachedTokens, commentTokens, comments, keywords ) );
        
        token.set( subTokenizers );
        
    }
    
    else if ( T_NGRAM & type )
    {
        // get n-gram tokenizer
        token = make_array_2( tok.tokens.slice() ).slice(); // array of arrays
        ngrams = [];
        
        for (i=0, l=token.length; i<l; i++)
        {
            // get tokenizers for each ngram part
            ngrams[i] = token[i].slice();
            // get tokenizer for whole ngram
            token[i] = new NGramToken( T_NGRAM, tokenID + '_NGRAM_' + i, null );
        }
        
        // pre-cache tokenizer to handle recursive calls to same tokenizer
        cachedTokens[ tokenID ] = token;
        
        for (i=0, l=token.length; i<l; i++)
        {
            ngram = ngrams[i];
            
            subTokenizers = [];
            for (j=0, l2=ngram.length; j<l2; j++)
                subTokenizers = subTokenizers.concat( getTokenizer( ngram[j], RegExpID, Lex, Syntax, Style, cachedRegexes, cachedMatchers, cachedTokens, commentTokens,  comments, keywords ) );
            
            // get tokenizer for whole ngram
            token[i].set( subTokenizers );
        }
    }
    return cachedTokens[ tokenID ];
}

function getComments( tok, comments ) 
{
    // build start/end mappings
    var tmp = make_array_2(tok.tokens.slice()); // array of arrays
    var start, end, lead, i, l;
    for (i=0, l=tmp.length; i<l; i++)
    {
        start = tmp[i][0];
        end = (tmp[i].length>1) ? tmp[i][1] : tmp[i][0];
        lead = (tmp[i].length>2) ? tmp[i][2] : "";
        
        if ( null === end )
        {
            // line comment
            comments.line = comments.line || [];
            comments.line.push( start );
        }
        else
        {
            // block comment
            comments.block = comments.block || [];
            comments.block.push( [start, end, lead] );
        }
    }
}

function getAutoComplete( tok, type, keywords ) 
{
    var kws = [].concat(make_array(tok.tokens)).map(function(word) { return { word: word, meta: type }; });
    keywords.autocomplete = (keywords.autocomplete || []).concat( kws );
}

function parseGrammar( grammar ) 
{
    var RegExpID, tokens, numTokens, _tokens, 
        Style, Lex, Syntax, t, tokenID, token, tok,
        cachedRegexes, cachedMatchers, cachedTokens, commentTokens, comments, keywords;
    
    // grammar is parsed, return it
    // avoid reparsing already parsed grammars
    if ( grammar.__parsed ) return grammar;
    
    cachedRegexes = { }; cachedMatchers = { }; cachedTokens = { }; 
    comments = { }; keywords = { }; commentTokens = [ ];
    grammar = clone( grammar );
    
    RegExpID = grammar.RegExpID || null;
    grammar.RegExpID = null;
    delete grammar.RegExpID;
    
    Lex = grammar.Lex || { };
    grammar.Lex = null;
    delete grammar.Lex;
    
    Syntax = grammar.Syntax || { };
    grammar.Syntax = null;
    delete grammar.Syntax;
    
    Style = grammar.Style || { };
    
    _tokens = grammar.Parser || [ ];
    numTokens = _tokens.length;
    tokens = [ ];
    
    
    // build tokens
    for (t=0; t<numTokens; t++)
    {
        tokenID = _tokens[ t ];
        
        token = getTokenizer( tokenID, RegExpID, Lex, Syntax, Style, cachedRegexes, cachedMatchers, cachedTokens, commentTokens, comments, keywords ) || null;
        
        if ( token )
        {
            if ( T_ARRAY & get_type( token ) ) tokens = tokens.concat( token );
            else tokens.push( token );
        }
    }
    
    grammar.Parser = tokens;
    grammar.cTokens = commentTokens;
    grammar.Style = Style;
    grammar.Comments = comments;
    grammar.Keywords = keywords;
    grammar.Extra = grammar.Extra || { };
    
    // this grammar is parsed
    grammar.__parsed = 1;
    return grammar;
}

/**
*
*   AceGrammar
*   @version: 0.11
*
*   Transform a grammar specification in JSON format, into an ACE syntax-highlight parser mode
*   https://github.com/foo123/ace-grammar
*
**/


// ace supposed to be available
var _ace = (typeof ace !== 'undefined') ? ace : { require: function() { return { }; }, config: {} }, 
    ace_require = _ace.require, ace_config = _ace.config
;

//
// parser factories
function WorkerClient( topLevelNamespaces, mod, classname ) 
{
    var self = this, require = ace_require, config = ace_config;
    self.$sendDeltaQueue = self.$sendDeltaQueue.bind(self);
    self.changeListener = self.changeListener.bind(self);
    self.onMessage = self.onMessage.bind(self);
    if (require.nameToUrl && !require.toUrl) require.toUrl = require.nameToUrl;

    var workerUrl;
    if (config.get("packaged") || !require.toUrl) {
        workerUrl = config.moduleUrl(mod, "worker");
    } else {
        var normalizePath = self.$normalizePath;
        workerUrl = normalizePath(require.toUrl("ace/worker/worker.js", null, "_"));

        var tlns = {};
        topLevelNamespaces.forEach(function(ns) {
            tlns[ns] = normalizePath(require.toUrl(ns, null, "_").replace(/(\.js)?(\?.*)?$/, ""));
        });
    }
    
    self.$worker = new Worker( workerUrl );
    
    self.$worker.postMessage({
        load: true,
        ace_worker_base: thisPath.base + '/' + ace_config.moduleUrl("ace/worker/json")
    });

    self.$worker.postMessage({
        init : true,
        tlns: tlns,
        module: mod,
        classname: classname
    });

    self.callbackId = 1;
    self.callbacks = {};

    self.$worker.onmessage = self.onMessage;
}
// extends ace_require("ace/worker/worker_client").WorkerClient
WorkerClient[PROTO] = Merge(
    Extend( (ace_require("ace/worker/worker_client").WorkerClient||Object)[PROTO] ), {
    constructor: WorkerClient
});
    
// extends ace_require('ace/tokenizer').Tokenizer
function Parser( grammar, LOC ) 
{
    var self = this, rxLine;
    // support comments toggle
    self.LC = grammar.Comments.line || null;
    self.BC = grammar.Comments.block ? { start: grammar.Comments.block[0][0], end: grammar.Comments.block[0][1] } : null;
    if ( self.LC )
    {
        if ( T_ARRAY & get_type(self.LC) ) 
            rxLine = self.LC.map( escRegexp ).join( "|" );
        
        else 
            rxLine = escRegexp( self.LC );
        
        self.rxLine = new RegExp("^(\\s*)(?:" + rxLine + ") ?");
    }
    if ( self.BC )
    {
        self.rxStart = new RegExp("^(\\s*)(?:" + escRegexp(self.BC.start) + ")");
        self.rxEnd = new RegExp("(?:" + escRegexp(self.BC.end) + ")\\s*$");
    }

    self.DEF = LOC.DEFAULT;
    self.ERR = grammar.Style.error || LOC.ERROR;
    
    // support keyword autocompletion
    self.Keywords = grammar.Keywords.autocomplete || null;
    
    self.Tokens = grammar.Parser || [];
    self.cTokens = grammar.cTokens.length ? grammar.cTokens : null;
    self.Style = grammar.Style;
}
Parser[PROTO] = Merge(
     Extend( (ace_require('ace/tokenizer').Tokenizer||Object)[PROTO] ), {
     constructor: Parser
    
    ,ERR: null
    ,DEF: null
    ,LC: null
    ,BC: null
    ,rxLine: null
    ,rxStart: null
    ,rxEnd: null
    ,Keywords: null
    ,cTokens: null
    ,Tokens: null
    ,Style: null

    ,dispose: function( ) {
        var self = this;
        self.ERR = null;
        self.DEF = null;
        self.LC = null;
        self.BC = null;
        self.rxLine = null;
        self.rxStart = null;
        self.rxEnd = null;
        self.Keywords = null;
        self.cTokens = null;
        self.Tokens = null;
        self.Style = null;
        return self;
    }
    
    ,parse: function( code ) {
        code = code || "";
        var self = this, lines = code.split(newline_re), l = lines.length, i, tokens = [], data;
        data = { state: new State( ), tokens: null };
        
        for (i=0; i<l; i++)
        {
            data = self.getLineTokens(lines[i], data.state, i);
            tokens.push(data.tokens);
        }
        return tokens;
    }
    
    // ACE Tokenizer compatible
    ,getLineTokens: function( line, state, row ) {
        
        var self = this, i, rewind, rewind2, ci,
            tokenizer, interleavedCommentTokens = self.cTokens, tokens = self.Tokens, numTokens = tokens.length, 
            aceTokens, token, type, style, currentError = null,
            stream, stack, DEFAULT = self.DEF, ERROR = self.ERR, Style = self.Style
        ;
        
        aceTokens = []; 
        stream = new Stream( line );
        state = state ? state.clone( 1 ) : new State( 1, 1 );
        state.l = 1+row;
        stack = state.stack;
        token = { type: null, value: "", error: null };
        type = null;
        style = null;
        
        // if EOL tokenizer is left on stack, pop it now
        if ( stream.sol() && !stack.isEmpty() && T_EOL === stack.peek().tt ) 
        {
            stack.pop();
        }
        
        while ( !stream.eol() )
        {
            rewind = 0;
            
            if ( style && style !== token.type )
            {
                if ( token.type ) aceTokens.push( token );
                token = { type: style, value: stream.cur(1), error: currentError };
                currentError = null;
            }
            else if ( token.type )
            {
                token.value += stream.cur(1);
            }
            style = false;
            
            // check for non-space tokenizer before parsing space
            if ( (stack.isEmpty() || (T_NONSPACE !== stack.peek().tt)) && stream.spc() )
            {
                state.t = type = DEFAULT;
                style = DEFAULT;
                continue;
            }
            
            while ( !stack.isEmpty() && !stream.eol() )
            {
                if ( interleavedCommentTokens )
                {
                    ci = 0; rewind2 = 0;
                    while ( ci < interleavedCommentTokens.length )
                    {
                        tokenizer = interleavedCommentTokens[ci++];
                        state.t = type = tokenizer.get(stream, state);
                        if ( false !== type )
                        {
                            style = Style[type] || DEFAULT;
                            rewind2 = 1;
                            break;
                        }
                    }
                    if ( rewind2 )
                    {
                        rewind = 1;
                        break;
                    }
                }
            
                tokenizer = stack.pop();
                state.t = type = tokenizer.get(stream, state);
            
                // match failed
                if ( false === type )
                {
                    // error
                    if ( tokenizer.ERR || tokenizer.REQ )
                    {
                        // empty the stack
                        stack.empty('sID', tokenizer.sID);
                        // skip this character
                        stream.nxt();
                        // generate error
                        state.t = type = ERROR;
                        style = ERROR;
                        currentError = tokenizer.err();
                        rewind = 1;
                        break;
                    }
                    // optional
                    else
                    {
                        style = false;
                        continue;
                    }
                }
                // found token (not empty)
                else if ( true !== type )
                {
                    style = Style[type] || DEFAULT;
                    // match action error
                    if ( tokenizer.MTCH )
                    {
                        // empty the stack
                        stack.empty('sID', tokenizer.sID);
                        // generate error
                        state.t = type = ERROR;
                        style = ERROR;
                        currentError = tokenizer.err();
                    }
                    rewind = 1;
                    break;
                }
            }
            
            if ( rewind ) continue;
            if ( stream.eol() ) break;
            
            for (i=0; i<numTokens; i++)
            {
                tokenizer = tokens[i];
                state.t = type = tokenizer.get(stream, state);
                
                // match failed
                if ( false === type )
                {
                    // error
                    if ( tokenizer.ERR || tokenizer.REQ )
                    {
                        // empty the stack
                        stack.empty('sID', tokenizer.sID);
                        // skip this character
                        stream.nxt();
                        // generate error
                        state.t = type = ERROR;
                        style = ERROR;
                        currentError = tokenizer.err();
                        rewind = 1;
                        break;
                    }
                    // optional
                    else
                    {
                        style = false;
                        continue;
                    }
                }
                // found token (not empty)
                else if ( true !== type )
                {
                    style = Style[type] || DEFAULT;
                    // match action error
                    if ( tokenizer.MTCH )
                    {
                        // empty the stack
                        stack.empty('sID', tokenizer.sID);
                        // generate error
                        state.t = type = ERROR;
                        style = ERROR;
                        currentError = tokenizer.err();
                    }
                    rewind = 1;
                    break;
                }
            }
            
            if ( rewind ) continue;
            if ( stream.eol() ) break;
            
            // unknown, bypass
            stream.nxt();
            state.t = type = DEFAULT;
            style = DEFAULT;
        }
        
        if ( style && style !== token.type )
        {
            if ( token.type ) aceTokens.push( token );
            aceTokens.push( { type: style, value: stream.cur(1), error: currentError } );
            currentError = null;
        }
        else if ( token.type )
        {
            token.value += stream.cur(1);
            aceTokens.push( token );
        }
        token = null;
        
        //console.log(aceTokens);
        
        // ACE Tokenizer compatible
        return { state: state, tokens: aceTokens };
    }
    
    ,tCL: function( state, session, startRow, endRow ) {
        var self = this,
            doc = session.doc,
            ignoreBlankLines = true,
            shouldRemove = true,
            minIndent = Infinity,
            tabSize = session.getTabSize(),
            insertAtTabStop = false,
            iterate, comment, uncomment, testRemove, shouldInsertSpace
        ;
        
        if ( !self.LC ) 
        {
            if ( !self.BC ) return false;
            
            var lineCommentStart = self.BC.start,
                lineCommentEnd = self.BC.end,
                regexpStart = self.rxStart,
                regexpEnd = self.rxEnd
            ;

            comment = function(line, i) {
                if (testRemove(line, i)) return;
                if (!ignoreBlankLines || /\S/.test(line)) 
                {
                    doc.insertInLine({row: i, column: line.length}, lineCommentEnd);
                    doc.insertInLine({row: i, column: minIndent}, lineCommentStart);
                }
            };

            uncomment = function(line, i) {
                var m;
                if (m = line.match(regexpEnd))
                    doc.removeInLine(i, line.length - m[0].length, line.length);
                if (m = line.match(regexpStart))
                    doc.removeInLine(i, m[1].length, m[0].length);
            };

            testRemove = function(line, row) {
                if (regexpStart.test(line)) return true;
                var tokens = session.getTokens(row);
                for (var i = 0; i < tokens.length; i++) 
                {
                    if (tokens[i].type === 'comment') return true;
                }
            };
        } 
        else 
        {
            var lineCommentStart = (T_ARRAY == get_type(self.LC)) ? self.LC[0] : self.LC,
                regexpLine = self.rxLine,
                commentWithSpace = lineCommentStart + " ",
                minEmptyLength
            ;
            
            insertAtTabStop = session.getUseSoftTabs();

            uncomment = function(line, i) {
                var m = line.match(regexpLine), start, end;
                if (!m) return;
                start = m[1].length; end = m[0].length;
                if (!shouldInsertSpace(line, start, end) && m[0][end - 1] == " ")  end--;
                doc.removeInLine(i, start, end);
            };
            
            comment = function(line, i) {
                if (!ignoreBlankLines || /\S/.test(line)) 
                {
                    if (shouldInsertSpace(line, minIndent, minIndent))
                        doc.insertInLine({row: i, column: minIndent}, commentWithSpace);
                    else
                        doc.insertInLine({row: i, column: minIndent}, lineCommentStart);
                }
            };
            
            testRemove = function(line, i) {
                return regexpLine.test(line);
            };

            shouldInsertSpace = function(line, before, after) {
                var spaces = 0;
                while (before-- && line.charAt(before) == " ") spaces++;
                if (spaces % tabSize != 0) return false;
                spaces = 0;
                while (line.charAt(after++) == " ") spaces++;
                if (tabSize > 2)  return spaces % tabSize != tabSize - 1;
                else  return spaces % tabSize == 0;
                return true;
            };
        }

        iterate = function( applyMethod ) { 
            for (var i=startRow; i<=endRow; i++) 
                applyMethod( doc.getLine(i), i ); 
        };


        minEmptyLength = Infinity;
        
        iterate(function(line, i) {
            var indent = line.search(/\S/);
            if (indent !== -1) 
            {
                if (indent < minIndent)  minIndent = indent;
                if (shouldRemove && !testRemove(line, i)) shouldRemove = false;
            } 
            else if (minEmptyLength > line.length)
            {
                minEmptyLength = line.length;
            }
        });

        if (Infinity == minIndent) 
        {
            minIndent = minEmptyLength;
            ignoreBlankLines = false;
            shouldRemove = false;
        }

        if (insertAtTabStop && minIndent % tabSize != 0)
            minIndent = Math.floor(minIndent / tabSize) * tabSize;

        iterate(shouldRemove ? uncomment : comment);
    }

    ,tBC: function( state, session, range, cursor ) {
        var self = this, 
            TokenIterator = ace_require('ace/token_iterator').TokenIterator,
            Range = ace_require('ace/range').Range,
            comment = self.BC, iterator, token, sel,
            initialRange, startRow, colDiff,
            startRange, endRange, i, row, column,
            comment_re = /comment/
        ;
        if (!comment) return;

        iterator = new TokenIterator(session, cursor.row, cursor.column);
        token = iterator.getCurrentToken();

        sel = session.selection;
        initialRange = sel.toOrientedRange();

        if (token && comment_re.test(token.type)) 
        {
            while (token && comment_re.test(token.type)) 
            {
                i = token.value.indexOf(comment.start);
                if (i != -1) 
                {
                    row = iterator.getCurrentTokenRow();
                    column = iterator.getCurrentTokenColumn() + i;
                    startRange = new Range(row, column, row, column + comment.start.length);
                    break;
                }
                token = iterator.stepBackward();
            };

            iterator = new TokenIterator(session, cursor.row, cursor.column);
            token = iterator.getCurrentToken();
            while (token && comment_re.test(token.type)) 
            {
                i = token.value.indexOf(comment.end);
                if (i != -1) 
                {
                    row = iterator.getCurrentTokenRow();
                    column = iterator.getCurrentTokenColumn() + i;
                    endRange = new Range(row, column, row, column + comment.end.length);
                    break;
                }
                token = iterator.stepForward();
            }
            if (endRange)
                session.remove(endRange);
            if (startRange) 
            {
                session.remove(startRange);
                startRow = startRange.start.row;
                colDiff = -comment.start.length;
            }
        } 
        else 
        {
            colDiff = comment.start.length;
            startRow = range.start.row;
            session.insert(range.end, comment.end);
            session.insert(range.start, comment.start);
        }
        if (initialRange.start.row == startRow)
            initialRange.start.column += colDiff;
        if (initialRange.end.row == startRow)
            initialRange.end.column += colDiff;
        session.selection.fromOrientedRange(initialRange);
    }
    
    // Default indentation, TODO
    ,indent: function( line ) { 
        return line.match(/^\s*/)[0]; 
    }
    
    ,getNextLineIndent: function( state, line, tab ) { 
        return line.match(/^\s*/)[0];
    }
});

//
// workers factories
function worker_init( )
{
    ace.define('ace/grammar_worker', 
        ['require', 'exports', 'module' , 'ace/worker/mirror'], 
        function( require, exports, module ) {
        var WorkerMirror = require("./worker/mirror").Mirror, AceGrammarWorker;
        
        exports.AceGrammarWorker = AceGrammarWorker = function AceGrammarWorker( sender ) {
            var self = this;
            WorkerMirror.call( self, sender );
            self.setTimeout( 500 );
        };
        // extends require("./worker/mirror").Mirror
        AceGrammarWorker[PROTO] = Merge(Extend(WorkerMirror[PROTO]), {
             constructor: AceGrammarWorker
            
            ,parser: null
            
            
            ,Init: function( grammar, id ) {
                var self = this;
                //console.log('Init called '+id);
                //console.log(grammar);
                self.parser = new Parser( parseGrammar( grammar ), { 
                    DEFAULT: DEFAULTSTYLE, 
                    ERROR: DEFAULTERROR 
                });
                self.sender.callback( 1, id );
            }
            
            
            ,onUpdate: function( ) {
                var self = this, sender = self.sender, parser = self.parser,
                    code, linetokens, tokens, errors,
                    line, lines, t, token, column, errorFound = 0
                ;
                
                if ( !parser )
                {
                    sender.emit( "ok", null );
                    return;
                }
                
                code = self.doc.getValue( );
                if ( !code || !code.length ) 
                {
                    sender.emit( "ok", null );
                    return;
                }
                
                errors = [];
                linetokens = parser.parse( code );
                lines = linetokens.length;
                
                for (line=0; line<lines; line++) 
                {
                    tokens = linetokens[ line ];
                    if ( !tokens || !tokens.length )  continue;
                    
                    column = 0;
                    for (t=0; t<tokens.length; t++)
                    {
                        token = tokens[t];
                        
                        if ( parser.ERR == token.type )
                        {
                            errors.push({
                                row: line,
                                column: column,
                                text: token.error || "Syntax Error",
                                type: "error",
                                raw: token.error || "Syntax Error"
                            });
                            
                            errorFound = 1;
                        }
                        column += token.value.length;
                    }
                }
                
                if ( errorFound )  sender.emit("error", errors);
                else  sender.emit("ok", null);
            }
        });
    });
}
if ( isWorker )
{
    onmessage = function( e ) {
        var msg = e.data;
        if ( msg.load && msg.ace_worker_base ) 
        {        
            // import an ace base worker with needed dependencies ??
            importScripts( msg.ace_worker_base );
            worker_init( );
        } 
    };
}

function getMode( grammar, DEFAULT ) 
{
    var parser = new Parser( parseGrammar( grammar ), { 
        // default return code for skipped or not-styled tokens
        // 'text' should be used in most cases
        DEFAULT: DEFAULT || DEFAULTSTYLE,
        ERROR: DEFAULTERROR
    }), mode, grammar_copy = clone( grammar );
    
    // ACE-compatible Mode
    return mode = {
        /*
        // Maybe needed in later versions..
        
        createModeDelegates: function (mapping) { },

        $delegator: function(method, args, defaultHandler) { },
        */
        
        // the custom Parser/Tokenizer
        getTokenizer: function( ) { 
            return parser; 
        },
        
        supportGrammarAnnotations: false,
        
        //HighlightRules: null,
        //$behaviour: parser.$behaviour || null,

        createWorker: function( session ) {
            
            if ( !mode.supportGrammarAnnotations ) return null;
            
            // add this worker as an ace custom module
            ace_config.setModuleUrl("ace/grammar_worker", thisPath.file);
            var worker = new WorkerClient(['ace'], "ace/grammar_worker", 'AceGrammarWorker');
            worker.attachToDocument( session.getDocument( ) );
            // create a worker for this grammar
            worker.call('Init', [grammar_copy], function( ){
                //console.log('Init returned');
                // hook worker to enable error annotations
                worker.on("error", function( e ) {
                    //console.log(e.data);
                    session.setAnnotations( e.data );
                });

                worker.on("ok", function() {
                    session.clearAnnotations( );
                });
            });
            return worker;
        },
        
        transformAction: function( state, action, editor, session, param ) { 
        },
        
        //lineCommentStart: parser.LC,
        //blockComment: parser.BC,
        toggleCommentLines: function( state, session, startRow, endRow ) { 
            return parser.tCL( state, session, startRow, endRow ); 
        },
        toggleBlockComment: function( state, session, range, cursor ) { 
            return parser.tBC( state, session, range, cursor ); 
        },

        //$getIndent: function(line) { return parser.indent(line); },
        getNextLineIndent: function( state, line, tab ) { 
            return parser.getNextLineIndent( state, line, tab ); 
        },
        checkOutdent: function( state, line, input ) { 
            return false; 
        },
        autoOutdent: function( state, doc, row ) { 
        },

        //$createKeywordList: function() { return parser.$createKeywordList(); },
        getKeywords: function( append ) { 
            var keywords = parser.Keywords;
            if ( !keywords ) return [ ];
            return keywords.map(function(word) {
                var w = word.word, wm = word.meta;
                return {
                    name: w,
                    value: w,
                    score: 1000,
                    meta: wm
                };
            });
        },
        getCompletions: function( state, session, pos, prefix ) {
            var keywords = parser.Keywords;
            if ( !keywords ) return [ ];
            var len = prefix.length;
            return keywords.map(function(word) {
                var w = word.word, wm = word.meta, wl = w.length;
                var match = (wl >= len) && (prefix === w.substr(0, len));
                return {
                    name: w,
                    value: w,
                    score: match ? (1000 - wl) : 0,
                    meta: wm
                };
            });
        }
    };
}


//
//  Ace Grammar main class
/**[DOC_MARKDOWN]
*
* ###AceGrammar Methods
*
* __For node:__
*
* ```javascript
* var AceGrammar = require('build/ace_grammar.js').AceGrammar;
* ```
*
* __For browser:__
*
* ```html
* <script src="build/ace_grammar.js"></script>
* ```
*
[/DOC_MARKDOWN]**/
DEFAULTSTYLE = "text";
DEFAULTERROR = "invalid";
var AceGrammar = exports['AceGrammar'] = {
    
    VERSION: "0.11",
    
    // extend a grammar using another base grammar
    /**[DOC_MARKDOWN]
    * __Method__: `extend`
    *
    * ```javascript
    * extendedgrammar = AceGrammar.extend( grammar, basegrammar1 [, basegrammar2, ..] );
    * ```
    *
    * Extend a grammar with basegrammar1, basegrammar2, etc..
    *
    * This way arbitrary dialects and variations can be handled more easily
    [/DOC_MARKDOWN]**/
    extend: extend,
    
    // parse a grammar
    /**[DOC_MARKDOWN]
    * __Method__: `parse`
    *
    * ```javascript
    * parsedgrammar = AceGrammar.parse(grammar);
    * ```
    *
    * This is used internally by the AceGrammar Class
    * In order to parse a JSON grammar to a form suitable to be used by the syntax-highlight parser.
    * However user can use this method to cache a parsedgrammar to be used later.
    * Already parsed grammars are NOT re-parsed when passed through the parse method again
    [/DOC_MARKDOWN]**/
    parse: parseGrammar,
    
    // get an ACE-compatible syntax-highlight mode from a grammar
    /**[DOC_MARKDOWN]
    * __Method__: `getMode`
    *
    * ```javascript
    * mode = AceGrammar.getMode( grammar, [, DEFAULT] );
    * ```
    *
    * This is the main method which transforms a JSON grammar into an ACE syntax-highlight parser.
    * DEFAULT is the default return value ("text" by default) for things that are skipped or not styled
    * In general there is no need to set this value, unless you need to return something else
    [/DOC_MARKDOWN]**/
    getMode: getMode
};
    
    /* main code ends here */
    /* export the module */
    return exports["AceGrammar"];
});