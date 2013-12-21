/**
*
*   classy.js
*   Object-Oriented mini-framework for JavaScript
*   @version: 0.3
*
*   https://github.com/foo123/classy.js
*
**/!function(t,e,o,r){o=o?[].concat(o):[];var n,p=o.length,i=new Array(p),c=new Array(p),s=new Array(p);for(n=0;p>n;n++)i[n]=o[n][0],c[n]=o[n][1];if("object"==typeof module&&module.exports){if("undefined"==typeof module.exports[e]){for(n=0;p>n;n++)s[n]=module.exports[i[n]]||require(c[n])[i[n]];module.exports[e]=r.apply(t,s)}}else if("function"==typeof define&&define.amd)define(["exports"].concat(c),function(o){if("undefined"==typeof o[e]){for(var n=Array.prototype.slice.call(arguments,1),p=0,c=n.length;c>p;p++)s[p]=o[i[p]];o[e]=r.apply(t,s)}});else if("undefined"==typeof t[e]){for(n=0;p>n;n++)s[n]=t[i[n]];t[e]=r.apply(t,s)}}(this,"Classy",null,function(){var t=Array.prototype.slice,e=(Array.prototype.splice,Array.prototype.concat,Object.prototype.hasOwnProperty),o=Object.defineProperties,r=Object.prototype.toString,n=Object.create||function(t,e){var r,n=function(){};return n.prototype=t,r=new n,r.__proto__=t,o&&"undefined"!=typeof e&&o(r,e),r},p=function(e){return e&&this.$class&&this.$class.$super&&(e="constructor"==e?this.$class.$super:this.$class.$super.prototype[""+e])?e.apply(this,t.call(arguments,1)||[]):void 0},i=function(){var o,n,p,i,c,s,a,l,f=t.call(arguments);for(n=f.shift()||{},o=f.length,l=0;o>l;l++)if(p=f[l],p&&"object"==typeof p)for(a in p)e.call(p,a)&&(s=p[a],i=r.call(s),c=typeof s,n[a]="number"==c||s instanceof Number?0+s:s&&("[object Array]"==i||s instanceof Array||"string"==c||s instanceof String)?s.slice(0):s);return n},c=function(t,e){t=t||Object,e=e||{};var o=e.constructor?e.constructor:function(){};return o.prototype=n(t.prototype),o.prototype=i(o.prototype,e),o.prototype.constructor=o.prototype.$class=o,o.prototype.$super=p,o.$super=t,o.$static="object"==typeof t.$static?i({},t.$static):{},o},s=Mixin=i,a=function(){var e=t.call(arguments),o=e.length,r=null;if(o>=2){var n,p,a="object"==typeof e[0]?e[0]:{},l=e[1]||{},f=e[2]||null,u={},y=a.Extends||a.extends||Object,d=a.Implements||a.implements,m=a.Mixin||a.mixin;if(d=d?[].concat(d):null,m=m?[].concat(m):null)for(n=0,p=m.length;p>n;n++)m[n].prototype&&(u=Mixin(u,m[n].prototype));if(d)for(n=0,p=d.length;p>n;n++)d[n].prototype&&(u=s(u,d[n].prototype));r=c(y,i(u,l)),f&&"object"==typeof f&&(r.$static=i(r.$static,f))}else r=c(Object,e[0]);return r};return{VERSION:"0.3",Class:a,Extends:c,Implements:s,Mixin:Mixin,Create:n,Merge:i}});