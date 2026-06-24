(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))n(r);new MutationObserver(r=>{for(const s of r)if(s.type==="childList")for(const l of s.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&n(l)}).observe(document,{childList:!0,subtree:!0});function t(r){const s={};return r.integrity&&(s.integrity=r.integrity),r.referrerPolicy&&(s.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?s.credentials="include":r.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function n(r){if(r.ep)return;r.ep=!0;const s=t(r);fetch(r.href,s)}})();/**
 * @license
 * Copyright 2010-2023 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const No="160",wh=0,ia=1,Rh=2,vc=1,Mc=2,gn=3,Fn=0,Ut=1,It=2,In=0,Fi=1,ra=2,sa=3,oa=4,Ch=5,Jn=100,Ph=101,Lh=102,aa=103,la=104,Dh=200,Ih=201,Uh=202,Nh=203,yo=204,So=205,Oh=206,Fh=207,Bh=208,Gh=209,zh=210,kh=211,Hh=212,Vh=213,Wh=214,Xh=0,qh=1,Yh=2,es=3,jh=4,Kh=5,$h=6,Jh=7,Oo=0,Zh=1,Qh=2,Un=0,eu=1,tu=2,nu=3,iu=4,ru=5,su=6,xc=300,Gi=301,zi=302,Eo=303,To=304,ms=306,ni=1e3,rn=1001,bo=1002,Pt=1003,ca=1004,ws=1005,Wt=1006,ou=1007,sr=1008,Nn=1009,au=1010,lu=1011,Fo=1012,yc=1013,Cn=1014,Pn=1015,or=1016,Sc=1017,Ec=1018,Qn=1020,cu=1021,sn=1023,hu=1024,uu=1025,ei=1026,ki=1027,du=1028,Tc=1029,fu=1030,bc=1031,Ac=1033,Rs=33776,Cs=33777,Ps=33778,Ls=33779,ha=35840,ua=35841,da=35842,fa=35843,wc=36196,pa=37492,ma=37496,ga=37808,_a=37809,va=37810,Ma=37811,xa=37812,ya=37813,Sa=37814,Ea=37815,Ta=37816,ba=37817,Aa=37818,wa=37819,Ra=37820,Ca=37821,Ds=36492,Pa=36494,La=36495,pu=36283,Da=36284,Ia=36285,Ua=36286,Rc=3e3,ti=3001,mu=3200,gu=3201,Bo=0,_u=1,Kt="",Mt="srgb",xn="srgb-linear",Go="display-p3",gs="display-p3-linear",ts="linear",et="srgb",ns="rec709",is="p3",hi=7680,Na=519,vu=512,Mu=513,xu=514,Cc=515,yu=516,Su=517,Eu=518,Tu=519,Ao=35044,Oa="300 es",wo=1035,vn=2e3,rs=2001;class ai{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){if(this._listeners===void 0)return!1;const n=this._listeners;return n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){if(this._listeners===void 0)return;const r=this._listeners[e];if(r!==void 0){const s=r.indexOf(t);s!==-1&&r.splice(s,1)}}dispatchEvent(e){if(this._listeners===void 0)return;const n=this._listeners[e.type];if(n!==void 0){e.target=this;const r=n.slice(0);for(let s=0,l=r.length;s<l;s++)r[s].call(this,e);e.target=null}}}const Et=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Is=Math.PI/180,Ro=180/Math.PI;function On(){const i=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Et[i&255]+Et[i>>8&255]+Et[i>>16&255]+Et[i>>24&255]+"-"+Et[e&255]+Et[e>>8&255]+"-"+Et[e>>16&15|64]+Et[e>>24&255]+"-"+Et[t&63|128]+Et[t>>8&255]+"-"+Et[t>>16&255]+Et[t>>24&255]+Et[n&255]+Et[n>>8&255]+Et[n>>16&255]+Et[n>>24&255]).toLowerCase()}function Dt(i,e,t){return Math.max(e,Math.min(t,i))}function bu(i,e){return(i%e+e)%e}function Us(i,e,t){return(1-t)*i+t*e}function Fa(i){return(i&i-1)===0&&i!==0}function Co(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function _n(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("Invalid component type.")}}function $e(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("Invalid component type.")}}class Re{constructor(e=0,t=0){Re.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,n=this.y,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6],this.y=r[1]*t+r[4]*n+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(Dt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const n=Math.cos(t),r=Math.sin(t),s=this.x-e.x,l=this.y-e.y;return this.x=s*n-l*r+e.x,this.y=s*r+l*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class He{constructor(e,t,n,r,s,l,o,c,h){He.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,r,s,l,o,c,h)}set(e,t,n,r,s,l,o,c,h){const u=this.elements;return u[0]=e,u[1]=r,u[2]=o,u[3]=t,u[4]=s,u[5]=c,u[6]=n,u[7]=l,u[8]=h,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,r=t.elements,s=this.elements,l=n[0],o=n[3],c=n[6],h=n[1],u=n[4],d=n[7],p=n[2],g=n[5],v=n[8],_=r[0],m=r[3],f=r[6],y=r[1],M=r[4],T=r[7],L=r[2],R=r[5],C=r[8];return s[0]=l*_+o*y+c*L,s[3]=l*m+o*M+c*R,s[6]=l*f+o*T+c*C,s[1]=h*_+u*y+d*L,s[4]=h*m+u*M+d*R,s[7]=h*f+u*T+d*C,s[2]=p*_+g*y+v*L,s[5]=p*m+g*M+v*R,s[8]=p*f+g*T+v*C,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[1],r=e[2],s=e[3],l=e[4],o=e[5],c=e[6],h=e[7],u=e[8];return t*l*u-t*o*h-n*s*u+n*o*c+r*s*h-r*l*c}invert(){const e=this.elements,t=e[0],n=e[1],r=e[2],s=e[3],l=e[4],o=e[5],c=e[6],h=e[7],u=e[8],d=u*l-o*h,p=o*c-u*s,g=h*s-l*c,v=t*d+n*p+r*g;if(v===0)return this.set(0,0,0,0,0,0,0,0,0);const _=1/v;return e[0]=d*_,e[1]=(r*h-u*n)*_,e[2]=(o*n-r*l)*_,e[3]=p*_,e[4]=(u*t-r*c)*_,e[5]=(r*s-o*t)*_,e[6]=g*_,e[7]=(n*c-h*t)*_,e[8]=(l*t-n*s)*_,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,r,s,l,o){const c=Math.cos(s),h=Math.sin(s);return this.set(n*c,n*h,-n*(c*l+h*o)+l+e,-r*h,r*c,-r*(-h*l+c*o)+o+t,0,0,1),this}scale(e,t){return this.premultiply(Ns.makeScale(e,t)),this}rotate(e){return this.premultiply(Ns.makeRotation(-e)),this}translate(e,t){return this.premultiply(Ns.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,n=e.elements;for(let r=0;r<9;r++)if(t[r]!==n[r])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const Ns=new He;function Pc(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function ss(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function Au(){const i=ss("canvas");return i.style.display="block",i}const Ba={};function ir(i){i in Ba||(Ba[i]=!0,console.warn(i))}const Ga=new He().set(.8224621,.177538,0,.0331941,.9668058,0,.0170827,.0723974,.9105199),za=new He().set(1.2249401,-.2249404,0,-.0420569,1.0420571,0,-.0196376,-.0786361,1.0982735),gr={[xn]:{transfer:ts,primaries:ns,toReference:i=>i,fromReference:i=>i},[Mt]:{transfer:et,primaries:ns,toReference:i=>i.convertSRGBToLinear(),fromReference:i=>i.convertLinearToSRGB()},[gs]:{transfer:ts,primaries:is,toReference:i=>i.applyMatrix3(za),fromReference:i=>i.applyMatrix3(Ga)},[Go]:{transfer:et,primaries:is,toReference:i=>i.convertSRGBToLinear().applyMatrix3(za),fromReference:i=>i.applyMatrix3(Ga).convertLinearToSRGB()}},wu=new Set([xn,gs]),Ke={enabled:!0,_workingColorSpace:xn,get workingColorSpace(){return this._workingColorSpace},set workingColorSpace(i){if(!wu.has(i))throw new Error(`Unsupported working color space, "${i}".`);this._workingColorSpace=i},convert:function(i,e,t){if(this.enabled===!1||e===t||!e||!t)return i;const n=gr[e].toReference,r=gr[t].fromReference;return r(n(i))},fromWorkingColorSpace:function(i,e){return this.convert(i,this._workingColorSpace,e)},toWorkingColorSpace:function(i,e){return this.convert(i,e,this._workingColorSpace)},getPrimaries:function(i){return gr[i].primaries},getTransfer:function(i){return i===Kt?ts:gr[i].transfer}};function Bi(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function Os(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}let ui;class Lc{static getDataURL(e){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let t;if(e instanceof HTMLCanvasElement)t=e;else{ui===void 0&&(ui=ss("canvas")),ui.width=e.width,ui.height=e.height;const n=ui.getContext("2d");e instanceof ImageData?n.putImageData(e,0,0):n.drawImage(e,0,0,e.width,e.height),t=ui}return t.width>2048||t.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",e),t.toDataURL("image/jpeg",.6)):t.toDataURL("image/png")}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=ss("canvas");t.width=e.width,t.height=e.height;const n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);const r=n.getImageData(0,0,e.width,e.height),s=r.data;for(let l=0;l<s.length;l++)s[l]=Bi(s[l]/255)*255;return n.putImageData(r,0,0),t}else if(e.data){const t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(Bi(t[n]/255)*255):t[n]=Bi(t[n]);return{data:t,width:e.width,height:e.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let Ru=0;class Dc{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Ru++}),this.uuid=On(),this.data=e,this.version=0}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const n={uuid:this.uuid,url:""},r=this.data;if(r!==null){let s;if(Array.isArray(r)){s=[];for(let l=0,o=r.length;l<o;l++)r[l].isDataTexture?s.push(Fs(r[l].image)):s.push(Fs(r[l]))}else s=Fs(r);n.url=s}return t||(e.images[this.uuid]=n),n}}function Fs(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?Lc.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let Cu=0;class Nt extends ai{constructor(e=Nt.DEFAULT_IMAGE,t=Nt.DEFAULT_MAPPING,n=rn,r=rn,s=Wt,l=sr,o=sn,c=Nn,h=Nt.DEFAULT_ANISOTROPY,u=Kt){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Cu++}),this.uuid=On(),this.name="",this.source=new Dc(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=r,this.magFilter=s,this.minFilter=l,this.anisotropy=h,this.format=o,this.internalFormat=null,this.type=c,this.offset=new Re(0,0),this.repeat=new Re(1,1),this.center=new Re(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new He,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,typeof u=="string"?this.colorSpace=u:(ir("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace=u===ti?Mt:Kt),this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.needsPMREMUpdate=!1}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==xc)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case ni:e.x=e.x-Math.floor(e.x);break;case rn:e.x=e.x<0?0:1;break;case bo:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case ni:e.y=e.y-Math.floor(e.y);break;case rn:e.y=e.y<0?0:1;break;case bo:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}get encoding(){return ir("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace===Mt?ti:Rc}set encoding(e){ir("THREE.Texture: Property .encoding has been replaced by .colorSpace."),this.colorSpace=e===ti?Mt:Kt}}Nt.DEFAULT_IMAGE=null;Nt.DEFAULT_MAPPING=xc;Nt.DEFAULT_ANISOTROPY=1;class mt{constructor(e=0,t=0,n=0,r=1){mt.prototype.isVector4=!0,this.x=e,this.y=t,this.z=n,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,r){return this.x=e,this.y=t,this.z=n,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,n=this.y,r=this.z,s=this.w,l=e.elements;return this.x=l[0]*t+l[4]*n+l[8]*r+l[12]*s,this.y=l[1]*t+l[5]*n+l[9]*r+l[13]*s,this.z=l[2]*t+l[6]*n+l[10]*r+l[14]*s,this.w=l[3]*t+l[7]*n+l[11]*r+l[15]*s,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,r,s;const c=e.elements,h=c[0],u=c[4],d=c[8],p=c[1],g=c[5],v=c[9],_=c[2],m=c[6],f=c[10];if(Math.abs(u-p)<.01&&Math.abs(d-_)<.01&&Math.abs(v-m)<.01){if(Math.abs(u+p)<.1&&Math.abs(d+_)<.1&&Math.abs(v+m)<.1&&Math.abs(h+g+f-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const M=(h+1)/2,T=(g+1)/2,L=(f+1)/2,R=(u+p)/4,C=(d+_)/4,V=(v+m)/4;return M>T&&M>L?M<.01?(n=0,r=.707106781,s=.707106781):(n=Math.sqrt(M),r=R/n,s=C/n):T>L?T<.01?(n=.707106781,r=0,s=.707106781):(r=Math.sqrt(T),n=R/r,s=V/r):L<.01?(n=.707106781,r=.707106781,s=0):(s=Math.sqrt(L),n=C/s,r=V/s),this.set(n,r,s,t),this}let y=Math.sqrt((m-v)*(m-v)+(d-_)*(d-_)+(p-u)*(p-u));return Math.abs(y)<.001&&(y=1),this.x=(m-v)/y,this.y=(d-_)/y,this.z=(p-u)/y,this.w=Math.acos((h+g+f-1)/2),this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this.w=Math.max(e.w,Math.min(t.w,this.w)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this.w=Math.max(e,Math.min(t,this.w)),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class Pu extends ai{constructor(e=1,t=1,n={}){super(),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=1,this.scissor=new mt(0,0,e,t),this.scissorTest=!1,this.viewport=new mt(0,0,e,t);const r={width:e,height:t,depth:1};n.encoding!==void 0&&(ir("THREE.WebGLRenderTarget: option.encoding has been replaced by option.colorSpace."),n.colorSpace=n.encoding===ti?Mt:Kt),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Wt,depthBuffer:!0,stencilBuffer:!1,depthTexture:null,samples:0},n),this.texture=new Nt(r,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.flipY=!1,this.texture.generateMipmaps=n.generateMipmaps,this.texture.internalFormat=n.internalFormat,this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}setSize(e,t,n=1){(this.width!==e||this.height!==t||this.depth!==n)&&(this.width=e,this.height=t,this.depth=n,this.texture.image.width=e,this.texture.image.height=t,this.texture.image.depth=n,this.dispose()),this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.texture=e.texture.clone(),this.texture.isRenderTargetTexture=!0;const t=Object.assign({},e.texture.image);return this.texture.source=new Dc(t),this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class ii extends Pu{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}}class Ic extends Nt{constructor(e=null,t=1,n=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=Pt,this.minFilter=Pt,this.wrapR=rn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Lu extends Nt{constructor(e=null,t=1,n=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=Pt,this.minFilter=Pt,this.wrapR=rn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class hr{constructor(e=0,t=0,n=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=r}static slerpFlat(e,t,n,r,s,l,o){let c=n[r+0],h=n[r+1],u=n[r+2],d=n[r+3];const p=s[l+0],g=s[l+1],v=s[l+2],_=s[l+3];if(o===0){e[t+0]=c,e[t+1]=h,e[t+2]=u,e[t+3]=d;return}if(o===1){e[t+0]=p,e[t+1]=g,e[t+2]=v,e[t+3]=_;return}if(d!==_||c!==p||h!==g||u!==v){let m=1-o;const f=c*p+h*g+u*v+d*_,y=f>=0?1:-1,M=1-f*f;if(M>Number.EPSILON){const L=Math.sqrt(M),R=Math.atan2(L,f*y);m=Math.sin(m*R)/L,o=Math.sin(o*R)/L}const T=o*y;if(c=c*m+p*T,h=h*m+g*T,u=u*m+v*T,d=d*m+_*T,m===1-o){const L=1/Math.sqrt(c*c+h*h+u*u+d*d);c*=L,h*=L,u*=L,d*=L}}e[t]=c,e[t+1]=h,e[t+2]=u,e[t+3]=d}static multiplyQuaternionsFlat(e,t,n,r,s,l){const o=n[r],c=n[r+1],h=n[r+2],u=n[r+3],d=s[l],p=s[l+1],g=s[l+2],v=s[l+3];return e[t]=o*v+u*d+c*g-h*p,e[t+1]=c*v+u*p+h*d-o*g,e[t+2]=h*v+u*g+o*p-c*d,e[t+3]=u*v-o*d-c*p-h*g,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,r){return this._x=e,this._y=t,this._z=n,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const n=e._x,r=e._y,s=e._z,l=e._order,o=Math.cos,c=Math.sin,h=o(n/2),u=o(r/2),d=o(s/2),p=c(n/2),g=c(r/2),v=c(s/2);switch(l){case"XYZ":this._x=p*u*d+h*g*v,this._y=h*g*d-p*u*v,this._z=h*u*v+p*g*d,this._w=h*u*d-p*g*v;break;case"YXZ":this._x=p*u*d+h*g*v,this._y=h*g*d-p*u*v,this._z=h*u*v-p*g*d,this._w=h*u*d+p*g*v;break;case"ZXY":this._x=p*u*d-h*g*v,this._y=h*g*d+p*u*v,this._z=h*u*v+p*g*d,this._w=h*u*d-p*g*v;break;case"ZYX":this._x=p*u*d-h*g*v,this._y=h*g*d+p*u*v,this._z=h*u*v-p*g*d,this._w=h*u*d+p*g*v;break;case"YZX":this._x=p*u*d+h*g*v,this._y=h*g*d+p*u*v,this._z=h*u*v-p*g*d,this._w=h*u*d-p*g*v;break;case"XZY":this._x=p*u*d-h*g*v,this._y=h*g*d-p*u*v,this._z=h*u*v+p*g*d,this._w=h*u*d+p*g*v;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+l)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const n=t/2,r=Math.sin(n);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,n=t[0],r=t[4],s=t[8],l=t[1],o=t[5],c=t[9],h=t[2],u=t[6],d=t[10],p=n+o+d;if(p>0){const g=.5/Math.sqrt(p+1);this._w=.25/g,this._x=(u-c)*g,this._y=(s-h)*g,this._z=(l-r)*g}else if(n>o&&n>d){const g=2*Math.sqrt(1+n-o-d);this._w=(u-c)/g,this._x=.25*g,this._y=(r+l)/g,this._z=(s+h)/g}else if(o>d){const g=2*Math.sqrt(1+o-n-d);this._w=(s-h)/g,this._x=(r+l)/g,this._y=.25*g,this._z=(c+u)/g}else{const g=2*Math.sqrt(1+d-n-o);this._w=(l-r)/g,this._x=(s+h)/g,this._y=(c+u)/g,this._z=.25*g}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<Number.EPSILON?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(Dt(this.dot(e),-1,1)))}rotateTowards(e,t){const n=this.angleTo(e);if(n===0)return this;const r=Math.min(1,t/n);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const n=e._x,r=e._y,s=e._z,l=e._w,o=t._x,c=t._y,h=t._z,u=t._w;return this._x=n*u+l*o+r*h-s*c,this._y=r*u+l*c+s*o-n*h,this._z=s*u+l*h+n*c-r*o,this._w=l*u-n*o-r*c-s*h,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);const n=this._x,r=this._y,s=this._z,l=this._w;let o=l*e._w+n*e._x+r*e._y+s*e._z;if(o<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,o=-o):this.copy(e),o>=1)return this._w=l,this._x=n,this._y=r,this._z=s,this;const c=1-o*o;if(c<=Number.EPSILON){const g=1-t;return this._w=g*l+t*this._w,this._x=g*n+t*this._x,this._y=g*r+t*this._y,this._z=g*s+t*this._z,this.normalize(),this}const h=Math.sqrt(c),u=Math.atan2(h,o),d=Math.sin((1-t)*u)/h,p=Math.sin(t*u)/h;return this._w=l*d+this._w*p,this._x=n*d+this._x*p,this._y=r*d+this._y*p,this._z=s*d+this._z*p,this._onChangeCallback(),this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){const e=Math.random(),t=Math.sqrt(1-e),n=Math.sqrt(e),r=2*Math.PI*Math.random(),s=2*Math.PI*Math.random();return this.set(t*Math.cos(r),n*Math.sin(s),n*Math.cos(s),t*Math.sin(r))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class P{constructor(e=0,t=0,n=0){P.prototype.isVector3=!0,this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(ka.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(ka.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,n=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6]*r,this.y=s[1]*t+s[4]*n+s[7]*r,this.z=s[2]*t+s[5]*n+s[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,n=this.y,r=this.z,s=e.elements,l=1/(s[3]*t+s[7]*n+s[11]*r+s[15]);return this.x=(s[0]*t+s[4]*n+s[8]*r+s[12])*l,this.y=(s[1]*t+s[5]*n+s[9]*r+s[13])*l,this.z=(s[2]*t+s[6]*n+s[10]*r+s[14])*l,this}applyQuaternion(e){const t=this.x,n=this.y,r=this.z,s=e.x,l=e.y,o=e.z,c=e.w,h=2*(l*r-o*n),u=2*(o*t-s*r),d=2*(s*n-l*t);return this.x=t+c*h+l*d-o*u,this.y=n+c*u+o*h-s*d,this.z=r+c*d+s*u-l*h,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,n=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[4]*n+s[8]*r,this.y=s[1]*t+s[5]*n+s[9]*r,this.z=s[2]*t+s[6]*n+s[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const n=e.x,r=e.y,s=e.z,l=t.x,o=t.y,c=t.z;return this.x=r*c-s*o,this.y=s*l-n*c,this.z=n*o-r*l,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Bs.copy(this).projectOnVector(e),this.sub(Bs)}reflect(e){return this.sub(Bs.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(Dt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y,r=this.z-e.z;return t*t+n*n+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){const r=Math.sin(t)*e;return this.x=r*Math.sin(n),this.y=Math.cos(t)*e,this.z=r*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=(Math.random()-.5)*2,t=Math.random()*Math.PI*2,n=Math.sqrt(1-e**2);return this.x=n*Math.cos(t),this.y=n*Math.sin(t),this.z=e,this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Bs=new P,ka=new hr;class li{constructor(e=new P(1/0,1/0,1/0),t=new P(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Qt.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Qt.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const n=Qt.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const n=e.geometry;if(n!==void 0){const s=n.getAttribute("position");if(t===!0&&s!==void 0&&e.isInstancedMesh!==!0)for(let l=0,o=s.count;l<o;l++)e.isMesh===!0?e.getVertexPosition(l,Qt):Qt.fromBufferAttribute(s,l),Qt.applyMatrix4(e.matrixWorld),this.expandByPoint(Qt);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),_r.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),_r.copy(n.boundingBox)),_r.applyMatrix4(e.matrixWorld),this.union(_r)}const r=e.children;for(let s=0,l=r.length;s<l;s++)this.expandByObject(r[s],t);return this}containsPoint(e){return!(e.x<this.min.x||e.x>this.max.x||e.y<this.min.y||e.y>this.max.y||e.z<this.min.z||e.z>this.max.z)}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return!(e.max.x<this.min.x||e.min.x>this.max.x||e.max.y<this.min.y||e.min.y>this.max.y||e.max.z<this.min.z||e.min.z>this.max.z)}intersectsSphere(e){return this.clampPoint(e.center,Qt),Qt.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Xi),vr.subVectors(this.max,Xi),di.subVectors(e.a,Xi),fi.subVectors(e.b,Xi),pi.subVectors(e.c,Xi),Sn.subVectors(fi,di),En.subVectors(pi,fi),kn.subVectors(di,pi);let t=[0,-Sn.z,Sn.y,0,-En.z,En.y,0,-kn.z,kn.y,Sn.z,0,-Sn.x,En.z,0,-En.x,kn.z,0,-kn.x,-Sn.y,Sn.x,0,-En.y,En.x,0,-kn.y,kn.x,0];return!Gs(t,di,fi,pi,vr)||(t=[1,0,0,0,1,0,0,0,1],!Gs(t,di,fi,pi,vr))?!1:(Mr.crossVectors(Sn,En),t=[Mr.x,Mr.y,Mr.z],Gs(t,di,fi,pi,vr))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Qt).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Qt).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(un[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),un[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),un[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),un[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),un[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),un[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),un[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),un[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(un),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}}const un=[new P,new P,new P,new P,new P,new P,new P,new P],Qt=new P,_r=new li,di=new P,fi=new P,pi=new P,Sn=new P,En=new P,kn=new P,Xi=new P,vr=new P,Mr=new P,Hn=new P;function Gs(i,e,t,n,r){for(let s=0,l=i.length-3;s<=l;s+=3){Hn.fromArray(i,s);const o=r.x*Math.abs(Hn.x)+r.y*Math.abs(Hn.y)+r.z*Math.abs(Hn.z),c=e.dot(Hn),h=t.dot(Hn),u=n.dot(Hn);if(Math.max(-Math.max(c,h,u),Math.min(c,h,u))>o)return!1}return!0}const Du=new li,qi=new P,zs=new P;class ur{constructor(e=new P,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const n=this.center;t!==void 0?n.copy(t):Du.setFromPoints(e).getCenter(n);let r=0;for(let s=0,l=e.length;s<l;s++)r=Math.max(r,n.distanceToSquared(e[s]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;qi.subVectors(e,this.center);const t=qi.lengthSq();if(t>this.radius*this.radius){const n=Math.sqrt(t),r=(n-this.radius)*.5;this.center.addScaledVector(qi,r/n),this.radius+=r}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(zs.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(qi.copy(e.center).add(zs)),this.expandByPoint(qi.copy(e.center).sub(zs))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}}const dn=new P,ks=new P,xr=new P,Tn=new P,Hs=new P,yr=new P,Vs=new P;class Uc{constructor(e=new P,t=new P(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,dn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=dn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(dn.copy(this.origin).addScaledVector(this.direction,t),dn.distanceToSquared(e))}distanceSqToSegment(e,t,n,r){ks.copy(e).add(t).multiplyScalar(.5),xr.copy(t).sub(e).normalize(),Tn.copy(this.origin).sub(ks);const s=e.distanceTo(t)*.5,l=-this.direction.dot(xr),o=Tn.dot(this.direction),c=-Tn.dot(xr),h=Tn.lengthSq(),u=Math.abs(1-l*l);let d,p,g,v;if(u>0)if(d=l*c-o,p=l*o-c,v=s*u,d>=0)if(p>=-v)if(p<=v){const _=1/u;d*=_,p*=_,g=d*(d+l*p+2*o)+p*(l*d+p+2*c)+h}else p=s,d=Math.max(0,-(l*p+o)),g=-d*d+p*(p+2*c)+h;else p=-s,d=Math.max(0,-(l*p+o)),g=-d*d+p*(p+2*c)+h;else p<=-v?(d=Math.max(0,-(-l*s+o)),p=d>0?-s:Math.min(Math.max(-s,-c),s),g=-d*d+p*(p+2*c)+h):p<=v?(d=0,p=Math.min(Math.max(-s,-c),s),g=p*(p+2*c)+h):(d=Math.max(0,-(l*s+o)),p=d>0?s:Math.min(Math.max(-s,-c),s),g=-d*d+p*(p+2*c)+h);else p=l>0?-s:s,d=Math.max(0,-(l*p+o)),g=-d*d+p*(p+2*c)+h;return n&&n.copy(this.origin).addScaledVector(this.direction,d),r&&r.copy(ks).addScaledVector(xr,p),g}intersectSphere(e,t){dn.subVectors(e.center,this.origin);const n=dn.dot(this.direction),r=dn.dot(dn)-n*n,s=e.radius*e.radius;if(r>s)return null;const l=Math.sqrt(s-r),o=n-l,c=n+l;return c<0?null:o<0?this.at(c,t):this.at(o,t)}intersectsSphere(e){return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){const n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,r,s,l,o,c;const h=1/this.direction.x,u=1/this.direction.y,d=1/this.direction.z,p=this.origin;return h>=0?(n=(e.min.x-p.x)*h,r=(e.max.x-p.x)*h):(n=(e.max.x-p.x)*h,r=(e.min.x-p.x)*h),u>=0?(s=(e.min.y-p.y)*u,l=(e.max.y-p.y)*u):(s=(e.max.y-p.y)*u,l=(e.min.y-p.y)*u),n>l||s>r||((s>n||isNaN(n))&&(n=s),(l<r||isNaN(r))&&(r=l),d>=0?(o=(e.min.z-p.z)*d,c=(e.max.z-p.z)*d):(o=(e.max.z-p.z)*d,c=(e.min.z-p.z)*d),n>c||o>r)||((o>n||n!==n)&&(n=o),(c<r||r!==r)&&(r=c),r<0)?null:this.at(n>=0?n:r,t)}intersectsBox(e){return this.intersectBox(e,dn)!==null}intersectTriangle(e,t,n,r,s){Hs.subVectors(t,e),yr.subVectors(n,e),Vs.crossVectors(Hs,yr);let l=this.direction.dot(Vs),o;if(l>0){if(r)return null;o=1}else if(l<0)o=-1,l=-l;else return null;Tn.subVectors(this.origin,e);const c=o*this.direction.dot(yr.crossVectors(Tn,yr));if(c<0)return null;const h=o*this.direction.dot(Hs.cross(Tn));if(h<0||c+h>l)return null;const u=-o*Tn.dot(Vs);return u<0?null:this.at(u/l,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class it{constructor(e,t,n,r,s,l,o,c,h,u,d,p,g,v,_,m){it.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,r,s,l,o,c,h,u,d,p,g,v,_,m)}set(e,t,n,r,s,l,o,c,h,u,d,p,g,v,_,m){const f=this.elements;return f[0]=e,f[4]=t,f[8]=n,f[12]=r,f[1]=s,f[5]=l,f[9]=o,f[13]=c,f[2]=h,f[6]=u,f[10]=d,f[14]=p,f[3]=g,f[7]=v,f[11]=_,f[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new it().fromArray(this.elements)}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){const t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){const t=this.elements,n=e.elements,r=1/mi.setFromMatrixColumn(e,0).length(),s=1/mi.setFromMatrixColumn(e,1).length(),l=1/mi.setFromMatrixColumn(e,2).length();return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=0,t[4]=n[4]*s,t[5]=n[5]*s,t[6]=n[6]*s,t[7]=0,t[8]=n[8]*l,t[9]=n[9]*l,t[10]=n[10]*l,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,n=e.x,r=e.y,s=e.z,l=Math.cos(n),o=Math.sin(n),c=Math.cos(r),h=Math.sin(r),u=Math.cos(s),d=Math.sin(s);if(e.order==="XYZ"){const p=l*u,g=l*d,v=o*u,_=o*d;t[0]=c*u,t[4]=-c*d,t[8]=h,t[1]=g+v*h,t[5]=p-_*h,t[9]=-o*c,t[2]=_-p*h,t[6]=v+g*h,t[10]=l*c}else if(e.order==="YXZ"){const p=c*u,g=c*d,v=h*u,_=h*d;t[0]=p+_*o,t[4]=v*o-g,t[8]=l*h,t[1]=l*d,t[5]=l*u,t[9]=-o,t[2]=g*o-v,t[6]=_+p*o,t[10]=l*c}else if(e.order==="ZXY"){const p=c*u,g=c*d,v=h*u,_=h*d;t[0]=p-_*o,t[4]=-l*d,t[8]=v+g*o,t[1]=g+v*o,t[5]=l*u,t[9]=_-p*o,t[2]=-l*h,t[6]=o,t[10]=l*c}else if(e.order==="ZYX"){const p=l*u,g=l*d,v=o*u,_=o*d;t[0]=c*u,t[4]=v*h-g,t[8]=p*h+_,t[1]=c*d,t[5]=_*h+p,t[9]=g*h-v,t[2]=-h,t[6]=o*c,t[10]=l*c}else if(e.order==="YZX"){const p=l*c,g=l*h,v=o*c,_=o*h;t[0]=c*u,t[4]=_-p*d,t[8]=v*d+g,t[1]=d,t[5]=l*u,t[9]=-o*u,t[2]=-h*u,t[6]=g*d+v,t[10]=p-_*d}else if(e.order==="XZY"){const p=l*c,g=l*h,v=o*c,_=o*h;t[0]=c*u,t[4]=-d,t[8]=h*u,t[1]=p*d+_,t[5]=l*u,t[9]=g*d-v,t[2]=v*d-g,t[6]=o*u,t[10]=_*d+p}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Iu,e,Uu)}lookAt(e,t,n){const r=this.elements;return Ft.subVectors(e,t),Ft.lengthSq()===0&&(Ft.z=1),Ft.normalize(),bn.crossVectors(n,Ft),bn.lengthSq()===0&&(Math.abs(n.z)===1?Ft.x+=1e-4:Ft.z+=1e-4,Ft.normalize(),bn.crossVectors(n,Ft)),bn.normalize(),Sr.crossVectors(Ft,bn),r[0]=bn.x,r[4]=Sr.x,r[8]=Ft.x,r[1]=bn.y,r[5]=Sr.y,r[9]=Ft.y,r[2]=bn.z,r[6]=Sr.z,r[10]=Ft.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,r=t.elements,s=this.elements,l=n[0],o=n[4],c=n[8],h=n[12],u=n[1],d=n[5],p=n[9],g=n[13],v=n[2],_=n[6],m=n[10],f=n[14],y=n[3],M=n[7],T=n[11],L=n[15],R=r[0],C=r[4],V=r[8],S=r[12],b=r[1],z=r[5],k=r[9],Q=r[13],I=r[2],N=r[6],W=r[10],j=r[14],q=r[3],Y=r[7],K=r[11],ne=r[15];return s[0]=l*R+o*b+c*I+h*q,s[4]=l*C+o*z+c*N+h*Y,s[8]=l*V+o*k+c*W+h*K,s[12]=l*S+o*Q+c*j+h*ne,s[1]=u*R+d*b+p*I+g*q,s[5]=u*C+d*z+p*N+g*Y,s[9]=u*V+d*k+p*W+g*K,s[13]=u*S+d*Q+p*j+g*ne,s[2]=v*R+_*b+m*I+f*q,s[6]=v*C+_*z+m*N+f*Y,s[10]=v*V+_*k+m*W+f*K,s[14]=v*S+_*Q+m*j+f*ne,s[3]=y*R+M*b+T*I+L*q,s[7]=y*C+M*z+T*N+L*Y,s[11]=y*V+M*k+T*W+L*K,s[15]=y*S+M*Q+T*j+L*ne,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[4],r=e[8],s=e[12],l=e[1],o=e[5],c=e[9],h=e[13],u=e[2],d=e[6],p=e[10],g=e[14],v=e[3],_=e[7],m=e[11],f=e[15];return v*(+s*c*d-r*h*d-s*o*p+n*h*p+r*o*g-n*c*g)+_*(+t*c*g-t*h*p+s*l*p-r*l*g+r*h*u-s*c*u)+m*(+t*h*d-t*o*g-s*l*d+n*l*g+s*o*u-n*h*u)+f*(-r*o*u-t*c*d+t*o*p+r*l*d-n*l*p+n*c*u)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){const r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=n),this}invert(){const e=this.elements,t=e[0],n=e[1],r=e[2],s=e[3],l=e[4],o=e[5],c=e[6],h=e[7],u=e[8],d=e[9],p=e[10],g=e[11],v=e[12],_=e[13],m=e[14],f=e[15],y=d*m*h-_*p*h+_*c*g-o*m*g-d*c*f+o*p*f,M=v*p*h-u*m*h-v*c*g+l*m*g+u*c*f-l*p*f,T=u*_*h-v*d*h+v*o*g-l*_*g-u*o*f+l*d*f,L=v*d*c-u*_*c-v*o*p+l*_*p+u*o*m-l*d*m,R=t*y+n*M+r*T+s*L;if(R===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const C=1/R;return e[0]=y*C,e[1]=(_*p*s-d*m*s-_*r*g+n*m*g+d*r*f-n*p*f)*C,e[2]=(o*m*s-_*c*s+_*r*h-n*m*h-o*r*f+n*c*f)*C,e[3]=(d*c*s-o*p*s-d*r*h+n*p*h+o*r*g-n*c*g)*C,e[4]=M*C,e[5]=(u*m*s-v*p*s+v*r*g-t*m*g-u*r*f+t*p*f)*C,e[6]=(v*c*s-l*m*s-v*r*h+t*m*h+l*r*f-t*c*f)*C,e[7]=(l*p*s-u*c*s+u*r*h-t*p*h-l*r*g+t*c*g)*C,e[8]=T*C,e[9]=(v*d*s-u*_*s-v*n*g+t*_*g+u*n*f-t*d*f)*C,e[10]=(l*_*s-v*o*s+v*n*h-t*_*h-l*n*f+t*o*f)*C,e[11]=(u*o*s-l*d*s-u*n*h+t*d*h+l*n*g-t*o*g)*C,e[12]=L*C,e[13]=(u*_*r-v*d*r+v*n*p-t*_*p-u*n*m+t*d*m)*C,e[14]=(v*o*r-l*_*r-v*n*c+t*_*c+l*n*m-t*o*m)*C,e[15]=(l*d*r-u*o*r+u*n*c-t*d*c-l*n*p+t*o*p)*C,this}scale(e){const t=this.elements,n=e.x,r=e.y,s=e.z;return t[0]*=n,t[4]*=r,t[8]*=s,t[1]*=n,t[5]*=r,t[9]*=s,t[2]*=n,t[6]*=r,t[10]*=s,t[3]*=n,t[7]*=r,t[11]*=s,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,r))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const n=Math.cos(t),r=Math.sin(t),s=1-n,l=e.x,o=e.y,c=e.z,h=s*l,u=s*o;return this.set(h*l+n,h*o-r*c,h*c+r*o,0,h*o+r*c,u*o+n,u*c-r*l,0,h*c-r*o,u*c+r*l,s*c*c+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,r,s,l){return this.set(1,n,s,0,e,1,l,0,t,r,1,0,0,0,0,1),this}compose(e,t,n){const r=this.elements,s=t._x,l=t._y,o=t._z,c=t._w,h=s+s,u=l+l,d=o+o,p=s*h,g=s*u,v=s*d,_=l*u,m=l*d,f=o*d,y=c*h,M=c*u,T=c*d,L=n.x,R=n.y,C=n.z;return r[0]=(1-(_+f))*L,r[1]=(g+T)*L,r[2]=(v-M)*L,r[3]=0,r[4]=(g-T)*R,r[5]=(1-(p+f))*R,r[6]=(m+y)*R,r[7]=0,r[8]=(v+M)*C,r[9]=(m-y)*C,r[10]=(1-(p+_))*C,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,n){const r=this.elements;let s=mi.set(r[0],r[1],r[2]).length();const l=mi.set(r[4],r[5],r[6]).length(),o=mi.set(r[8],r[9],r[10]).length();this.determinant()<0&&(s=-s),e.x=r[12],e.y=r[13],e.z=r[14],en.copy(this);const h=1/s,u=1/l,d=1/o;return en.elements[0]*=h,en.elements[1]*=h,en.elements[2]*=h,en.elements[4]*=u,en.elements[5]*=u,en.elements[6]*=u,en.elements[8]*=d,en.elements[9]*=d,en.elements[10]*=d,t.setFromRotationMatrix(en),n.x=s,n.y=l,n.z=o,this}makePerspective(e,t,n,r,s,l,o=vn){const c=this.elements,h=2*s/(t-e),u=2*s/(n-r),d=(t+e)/(t-e),p=(n+r)/(n-r);let g,v;if(o===vn)g=-(l+s)/(l-s),v=-2*l*s/(l-s);else if(o===rs)g=-l/(l-s),v=-l*s/(l-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=u,c[9]=p,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=v,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,r,s,l,o=vn){const c=this.elements,h=1/(t-e),u=1/(n-r),d=1/(l-s),p=(t+e)*h,g=(n+r)*u;let v,_;if(o===vn)v=(l+s)*d,_=-2*d;else if(o===rs)v=s*d,_=-1*d;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=2*h,c[4]=0,c[8]=0,c[12]=-p,c[1]=0,c[5]=2*u,c[9]=0,c[13]=-g,c[2]=0,c[6]=0,c[10]=_,c[14]=-v,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){const t=this.elements,n=e.elements;for(let r=0;r<16;r++)if(t[r]!==n[r])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}}const mi=new P,en=new it,Iu=new P(0,0,0),Uu=new P(1,1,1),bn=new P,Sr=new P,Ft=new P,Ha=new it,Va=new hr;class Bn{constructor(e=0,t=0,n=0,r=Bn.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,r=this._order){return this._x=e,this._y=t,this._z=n,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){const r=e.elements,s=r[0],l=r[4],o=r[8],c=r[1],h=r[5],u=r[9],d=r[2],p=r[6],g=r[10];switch(t){case"XYZ":this._y=Math.asin(Dt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-u,g),this._z=Math.atan2(-l,s)):(this._x=Math.atan2(p,h),this._z=0);break;case"YXZ":this._x=Math.asin(-Dt(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(o,g),this._z=Math.atan2(c,h)):(this._y=Math.atan2(-d,s),this._z=0);break;case"ZXY":this._x=Math.asin(Dt(p,-1,1)),Math.abs(p)<.9999999?(this._y=Math.atan2(-d,g),this._z=Math.atan2(-l,h)):(this._y=0,this._z=Math.atan2(c,s));break;case"ZYX":this._y=Math.asin(-Dt(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(p,g),this._z=Math.atan2(c,s)):(this._x=0,this._z=Math.atan2(-l,h));break;case"YZX":this._z=Math.asin(Dt(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-u,h),this._y=Math.atan2(-d,s)):(this._x=0,this._y=Math.atan2(o,g));break;case"XZY":this._z=Math.asin(-Dt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(p,h),this._y=Math.atan2(o,s)):(this._x=Math.atan2(-u,g),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Ha.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Ha,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Va.setFromEuler(this),this.setFromQuaternion(Va,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}Bn.DEFAULT_ORDER="XYZ";class zo{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let Nu=0;const Wa=new P,gi=new hr,fn=new it,Er=new P,Yi=new P,Ou=new P,Fu=new hr,Xa=new P(1,0,0),qa=new P(0,1,0),Ya=new P(0,0,1),Bu={type:"added"},Gu={type:"removed"};class _t extends ai{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Nu++}),this.uuid=On(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=_t.DEFAULT_UP.clone();const e=new P,t=new Bn,n=new hr,r=new P(1,1,1);function s(){n.setFromEuler(t,!1)}function l(){t.setFromQuaternion(n,void 0,!1)}t._onChange(s),n._onChange(l),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new it},normalMatrix:{value:new He}}),this.matrix=new it,this.matrixWorld=new it,this.matrixAutoUpdate=_t.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=_t.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new zo,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return gi.setFromAxisAngle(e,t),this.quaternion.multiply(gi),this}rotateOnWorldAxis(e,t){return gi.setFromAxisAngle(e,t),this.quaternion.premultiply(gi),this}rotateX(e){return this.rotateOnAxis(Xa,e)}rotateY(e){return this.rotateOnAxis(qa,e)}rotateZ(e){return this.rotateOnAxis(Ya,e)}translateOnAxis(e,t){return Wa.copy(e).applyQuaternion(this.quaternion),this.position.add(Wa.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Xa,e)}translateY(e){return this.translateOnAxis(qa,e)}translateZ(e){return this.translateOnAxis(Ya,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(fn.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?Er.copy(e):Er.set(e,t,n);const r=this.parent;this.updateWorldMatrix(!0,!1),Yi.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?fn.lookAt(Yi,Er,this.up):fn.lookAt(Er,Yi,this.up),this.quaternion.setFromRotationMatrix(fn),r&&(fn.extractRotation(r.matrixWorld),gi.setFromRotationMatrix(fn),this.quaternion.premultiply(gi.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.parent!==null&&e.parent.remove(e),e.parent=this,this.children.push(e),e.dispatchEvent(Bu)):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Gu)),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),fn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),fn.multiply(e.parent.matrixWorld)),e.applyMatrix4(fn),this.add(e),e.updateWorldMatrix(!1,!0),this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,r=this.children.length;n<r;n++){const l=this.children[n].getObjectByProperty(e,t);if(l!==void 0)return l}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);const r=this.children;for(let s=0,l=r.length;s<l;s++)r[s].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Yi,e,Ou),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Yi,Fu,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let n=0,r=t.length;n<r;n++){const s=t[n];(s.matrixWorldAutoUpdate===!0||e===!0)&&s.updateMatrixWorld(e)}}updateWorldMatrix(e,t){const n=this.parent;if(e===!0&&n!==null&&n.matrixWorldAutoUpdate===!0&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),t===!0){const r=this.children;for(let s=0,l=r.length;s<l;s++){const o=r[s];o.matrixWorldAutoUpdate===!0&&o.updateWorldMatrix(!1,!0)}}}toJSON(e){const t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const r={};r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.visibility=this._visibility,r.active=this._active,r.bounds=this._bounds.map(o=>({boxInitialized:o.boxInitialized,boxMin:o.box.min.toArray(),boxMax:o.box.max.toArray(),sphereInitialized:o.sphereInitialized,sphereRadius:o.sphere.radius,sphereCenter:o.sphere.center.toArray()})),r.maxGeometryCount=this._maxGeometryCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.geometryCount=this._geometryCount,r.matricesTexture=this._matricesTexture.toJSON(e),this.boundingSphere!==null&&(r.boundingSphere={center:r.boundingSphere.center.toArray(),radius:r.boundingSphere.radius}),this.boundingBox!==null&&(r.boundingBox={min:r.boundingBox.min.toArray(),max:r.boundingBox.max.toArray()}));function s(o,c){return o[c.uuid]===void 0&&(o[c.uuid]=c.toJSON(e)),c.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(e.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const c=o.shapes;if(Array.isArray(c))for(let h=0,u=c.length;h<u;h++){const d=c[h];s(e.shapes,d)}else s(e.shapes,c)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let c=0,h=this.material.length;c<h;c++)o.push(s(e.materials,this.material[c]));r.material=o}else r.material=s(e.materials,this.material);if(this.children.length>0){r.children=[];for(let o=0;o<this.children.length;o++)r.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let o=0;o<this.animations.length;o++){const c=this.animations[o];r.animations.push(s(e.animations,c))}}if(t){const o=l(e.geometries),c=l(e.materials),h=l(e.textures),u=l(e.images),d=l(e.shapes),p=l(e.skeletons),g=l(e.animations),v=l(e.nodes);o.length>0&&(n.geometries=o),c.length>0&&(n.materials=c),h.length>0&&(n.textures=h),u.length>0&&(n.images=u),d.length>0&&(n.shapes=d),p.length>0&&(n.skeletons=p),g.length>0&&(n.animations=g),v.length>0&&(n.nodes=v)}return n.object=r,n;function l(o){const c=[];for(const h in o){const u=o[h];delete u.metadata,c.push(u)}return c}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){const r=e.children[n];this.add(r.clone())}return this}}_t.DEFAULT_UP=new P(0,1,0);_t.DEFAULT_MATRIX_AUTO_UPDATE=!0;_t.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const tn=new P,pn=new P,Ws=new P,mn=new P,_i=new P,vi=new P,ja=new P,Xs=new P,qs=new P,Ys=new P;let Tr=!1;class Xt{constructor(e=new P,t=new P,n=new P){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,r){r.subVectors(n,t),tn.subVectors(e,t),r.cross(tn);const s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(e,t,n,r,s){tn.subVectors(r,t),pn.subVectors(n,t),Ws.subVectors(e,t);const l=tn.dot(tn),o=tn.dot(pn),c=tn.dot(Ws),h=pn.dot(pn),u=pn.dot(Ws),d=l*h-o*o;if(d===0)return s.set(0,0,0),null;const p=1/d,g=(h*c-o*u)*p,v=(l*u-o*c)*p;return s.set(1-g-v,v,g)}static containsPoint(e,t,n,r){return this.getBarycoord(e,t,n,r,mn)===null?!1:mn.x>=0&&mn.y>=0&&mn.x+mn.y<=1}static getUV(e,t,n,r,s,l,o,c){return Tr===!1&&(console.warn("THREE.Triangle.getUV() has been renamed to THREE.Triangle.getInterpolation()."),Tr=!0),this.getInterpolation(e,t,n,r,s,l,o,c)}static getInterpolation(e,t,n,r,s,l,o,c){return this.getBarycoord(e,t,n,r,mn)===null?(c.x=0,c.y=0,"z"in c&&(c.z=0),"w"in c&&(c.w=0),null):(c.setScalar(0),c.addScaledVector(s,mn.x),c.addScaledVector(l,mn.y),c.addScaledVector(o,mn.z),c)}static isFrontFacing(e,t,n,r){return tn.subVectors(n,t),pn.subVectors(e,t),tn.cross(pn).dot(r)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,r){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,n,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return tn.subVectors(this.c,this.b),pn.subVectors(this.a,this.b),tn.cross(pn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return Xt.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return Xt.getBarycoord(e,this.a,this.b,this.c,t)}getUV(e,t,n,r,s){return Tr===!1&&(console.warn("THREE.Triangle.getUV() has been renamed to THREE.Triangle.getInterpolation()."),Tr=!0),Xt.getInterpolation(e,this.a,this.b,this.c,t,n,r,s)}getInterpolation(e,t,n,r,s){return Xt.getInterpolation(e,this.a,this.b,this.c,t,n,r,s)}containsPoint(e){return Xt.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return Xt.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const n=this.a,r=this.b,s=this.c;let l,o;_i.subVectors(r,n),vi.subVectors(s,n),Xs.subVectors(e,n);const c=_i.dot(Xs),h=vi.dot(Xs);if(c<=0&&h<=0)return t.copy(n);qs.subVectors(e,r);const u=_i.dot(qs),d=vi.dot(qs);if(u>=0&&d<=u)return t.copy(r);const p=c*d-u*h;if(p<=0&&c>=0&&u<=0)return l=c/(c-u),t.copy(n).addScaledVector(_i,l);Ys.subVectors(e,s);const g=_i.dot(Ys),v=vi.dot(Ys);if(v>=0&&g<=v)return t.copy(s);const _=g*h-c*v;if(_<=0&&h>=0&&v<=0)return o=h/(h-v),t.copy(n).addScaledVector(vi,o);const m=u*v-g*d;if(m<=0&&d-u>=0&&g-v>=0)return ja.subVectors(s,r),o=(d-u)/(d-u+(g-v)),t.copy(r).addScaledVector(ja,o);const f=1/(m+_+p);return l=_*f,o=p*f,t.copy(n).addScaledVector(_i,l).addScaledVector(vi,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}const Nc={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},An={h:0,s:0,l:0},br={h:0,s:0,l:0};function js(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+(e-i)*6*t:t<1/2?e:t<2/3?i+(e-i)*6*(2/3-t):i}class We{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){const r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Mt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Ke.toWorkingColorSpace(this,t),this}setRGB(e,t,n,r=Ke.workingColorSpace){return this.r=e,this.g=t,this.b=n,Ke.toWorkingColorSpace(this,r),this}setHSL(e,t,n,r=Ke.workingColorSpace){if(e=bu(e,1),t=Dt(t,0,1),n=Dt(n,0,1),t===0)this.r=this.g=this.b=n;else{const s=n<=.5?n*(1+t):n+t-n*t,l=2*n-s;this.r=js(l,s,e+1/3),this.g=js(l,s,e),this.b=js(l,s,e-1/3)}return Ke.toWorkingColorSpace(this,r),this}setStyle(e,t=Mt){function n(s){s!==void 0&&parseFloat(s)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let s;const l=r[1],o=r[2];switch(l){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,t);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,t);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){const s=r[1],l=s.length;if(l===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,t);if(l===6)return this.setHex(parseInt(s,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Mt){const n=Nc[e.toLowerCase()];return n!==void 0?this.setHex(n,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Bi(e.r),this.g=Bi(e.g),this.b=Bi(e.b),this}copyLinearToSRGB(e){return this.r=Os(e.r),this.g=Os(e.g),this.b=Os(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Mt){return Ke.fromWorkingColorSpace(Tt.copy(this),e),Math.round(Dt(Tt.r*255,0,255))*65536+Math.round(Dt(Tt.g*255,0,255))*256+Math.round(Dt(Tt.b*255,0,255))}getHexString(e=Mt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Ke.workingColorSpace){Ke.fromWorkingColorSpace(Tt.copy(this),t);const n=Tt.r,r=Tt.g,s=Tt.b,l=Math.max(n,r,s),o=Math.min(n,r,s);let c,h;const u=(o+l)/2;if(o===l)c=0,h=0;else{const d=l-o;switch(h=u<=.5?d/(l+o):d/(2-l-o),l){case n:c=(r-s)/d+(r<s?6:0);break;case r:c=(s-n)/d+2;break;case s:c=(n-r)/d+4;break}c/=6}return e.h=c,e.s=h,e.l=u,e}getRGB(e,t=Ke.workingColorSpace){return Ke.fromWorkingColorSpace(Tt.copy(this),t),e.r=Tt.r,e.g=Tt.g,e.b=Tt.b,e}getStyle(e=Mt){Ke.fromWorkingColorSpace(Tt.copy(this),e);const t=Tt.r,n=Tt.g,r=Tt.b;return e!==Mt?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(r*255)})`}offsetHSL(e,t,n){return this.getHSL(An),this.setHSL(An.h+e,An.s+t,An.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(An),e.getHSL(br);const n=Us(An.h,br.h,t),r=Us(An.s,br.s,t),s=Us(An.l,br.l,t);return this.setHSL(n,r,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,n=this.g,r=this.b,s=e.elements;return this.r=s[0]*t+s[3]*n+s[6]*r,this.g=s[1]*t+s[4]*n+s[7]*r,this.b=s[2]*t+s[5]*n+s[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Tt=new We;We.NAMES=Nc;let zu=0;class ci extends ai{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:zu++}),this.uuid=On(),this.name="",this.type="Material",this.blending=Fi,this.side=Fn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=yo,this.blendDst=So,this.blendEquation=Jn,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new We(0,0,0),this.blendAlpha=0,this.depthFunc=es,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Na,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=hi,this.stencilZFail=hi,this.stencilZPass=hi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBuild(){}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const n=e[t];if(n===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}const r=this[t];if(r===void 0){console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(n):r&&r.isVector3&&n&&n.isVector3?r.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Fi&&(n.blending=this.blending),this.side!==Fn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==yo&&(n.blendSrc=this.blendSrc),this.blendDst!==So&&(n.blendDst=this.blendDst),this.blendEquation!==Jn&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==es&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Na&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==hi&&(n.stencilFail=this.stencilFail),this.stencilZFail!==hi&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==hi&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function r(s){const l=[];for(const o in s){const c=s[o];delete c.metadata,l.push(c)}return l}if(t){const s=r(e.textures),l=r(e.images);s.length>0&&(n.textures=s),l.length>0&&(n.images=l)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let n=null;if(t!==null){const r=t.length;n=new Array(r);for(let s=0;s!==r;++s)n[s]=t[s].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}class vt extends ci{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new We(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=Oo,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const lt=new P,Ar=new Re;class $t{constructor(e,t,n=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=Ao,this._updateRange={offset:0,count:-1},this.updateRanges=[],this.gpuType=Pn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}get updateRange(){return console.warn("THREE.BufferAttribute: updateRange() is deprecated and will be removed in r169. Use addUpdateRange() instead."),this._updateRange}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let r=0,s=this.itemSize;r<s;r++)this.array[e+r]=t.array[n+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Ar.fromBufferAttribute(this,t),Ar.applyMatrix3(e),this.setXY(t,Ar.x,Ar.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)lt.fromBufferAttribute(this,t),lt.applyMatrix3(e),this.setXYZ(t,lt.x,lt.y,lt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)lt.fromBufferAttribute(this,t),lt.applyMatrix4(e),this.setXYZ(t,lt.x,lt.y,lt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)lt.fromBufferAttribute(this,t),lt.applyNormalMatrix(e),this.setXYZ(t,lt.x,lt.y,lt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)lt.fromBufferAttribute(this,t),lt.transformDirection(e),this.setXYZ(t,lt.x,lt.y,lt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=_n(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=$e(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=_n(t,this.array)),t}setX(e,t){return this.normalized&&(t=$e(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=_n(t,this.array)),t}setY(e,t){return this.normalized&&(t=$e(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=_n(t,this.array)),t}setZ(e,t){return this.normalized&&(t=$e(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=_n(t,this.array)),t}setW(e,t){return this.normalized&&(t=$e(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=$e(t,this.array),n=$e(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,r){return e*=this.itemSize,this.normalized&&(t=$e(t,this.array),n=$e(n,this.array),r=$e(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this}setXYZW(e,t,n,r,s){return e*=this.itemSize,this.normalized&&(t=$e(t,this.array),n=$e(n,this.array),r=$e(r,this.array),s=$e(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Ao&&(e.usage=this.usage),e}}class Oc extends $t{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class Fc extends $t{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class ct extends $t{constructor(e,t,n){super(new Float32Array(e),t,n)}}let ku=0;const Vt=new it,Ks=new _t,Mi=new P,Bt=new li,ji=new li,pt=new P;class Zt extends ai{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:ku++}),this.uuid=On(),this.name="",this.type="BufferGeometry",this.index=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Pc(e)?Fc:Oc)(e,1):this.index=e,this}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const s=new He().getNormalMatrix(e);n.applyNormalMatrix(s),n.needsUpdate=!0}const r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return Vt.makeRotationFromQuaternion(e),this.applyMatrix4(Vt),this}rotateX(e){return Vt.makeRotationX(e),this.applyMatrix4(Vt),this}rotateY(e){return Vt.makeRotationY(e),this.applyMatrix4(Vt),this}rotateZ(e){return Vt.makeRotationZ(e),this.applyMatrix4(Vt),this}translate(e,t,n){return Vt.makeTranslation(e,t,n),this.applyMatrix4(Vt),this}scale(e,t,n){return Vt.makeScale(e,t,n),this.applyMatrix4(Vt),this}lookAt(e){return Ks.lookAt(e),Ks.updateMatrix(),this.applyMatrix4(Ks.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Mi).negate(),this.translate(Mi.x,Mi.y,Mi.z),this}setFromPoints(e){const t=[];for(let n=0,r=e.length;n<r;n++){const s=e[n];t.push(s.x,s.y,s.z||0)}return this.setAttribute("position",new ct(t,3)),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new li);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error('THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box. Alternatively set "mesh.frustumCulled" to "false".',this),this.boundingBox.set(new P(-1/0,-1/0,-1/0),new P(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,r=t.length;n<r;n++){const s=t[n];Bt.setFromBufferAttribute(s),this.morphTargetsRelative?(pt.addVectors(this.boundingBox.min,Bt.min),this.boundingBox.expandByPoint(pt),pt.addVectors(this.boundingBox.max,Bt.max),this.boundingBox.expandByPoint(pt)):(this.boundingBox.expandByPoint(Bt.min),this.boundingBox.expandByPoint(Bt.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new ur);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error('THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere. Alternatively set "mesh.frustumCulled" to "false".',this),this.boundingSphere.set(new P,1/0);return}if(e){const n=this.boundingSphere.center;if(Bt.setFromBufferAttribute(e),t)for(let s=0,l=t.length;s<l;s++){const o=t[s];ji.setFromBufferAttribute(o),this.morphTargetsRelative?(pt.addVectors(Bt.min,ji.min),Bt.expandByPoint(pt),pt.addVectors(Bt.max,ji.max),Bt.expandByPoint(pt)):(Bt.expandByPoint(ji.min),Bt.expandByPoint(ji.max))}Bt.getCenter(n);let r=0;for(let s=0,l=e.count;s<l;s++)pt.fromBufferAttribute(e,s),r=Math.max(r,n.distanceToSquared(pt));if(t)for(let s=0,l=t.length;s<l;s++){const o=t[s],c=this.morphTargetsRelative;for(let h=0,u=o.count;h<u;h++)pt.fromBufferAttribute(o,h),c&&(Mi.fromBufferAttribute(e,h),pt.add(Mi)),r=Math.max(r,n.distanceToSquared(pt))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=e.array,r=t.position.array,s=t.normal.array,l=t.uv.array,o=r.length/3;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new $t(new Float32Array(4*o),4));const c=this.getAttribute("tangent").array,h=[],u=[];for(let b=0;b<o;b++)h[b]=new P,u[b]=new P;const d=new P,p=new P,g=new P,v=new Re,_=new Re,m=new Re,f=new P,y=new P;function M(b,z,k){d.fromArray(r,b*3),p.fromArray(r,z*3),g.fromArray(r,k*3),v.fromArray(l,b*2),_.fromArray(l,z*2),m.fromArray(l,k*2),p.sub(d),g.sub(d),_.sub(v),m.sub(v);const Q=1/(_.x*m.y-m.x*_.y);isFinite(Q)&&(f.copy(p).multiplyScalar(m.y).addScaledVector(g,-_.y).multiplyScalar(Q),y.copy(g).multiplyScalar(_.x).addScaledVector(p,-m.x).multiplyScalar(Q),h[b].add(f),h[z].add(f),h[k].add(f),u[b].add(y),u[z].add(y),u[k].add(y))}let T=this.groups;T.length===0&&(T=[{start:0,count:n.length}]);for(let b=0,z=T.length;b<z;++b){const k=T[b],Q=k.start,I=k.count;for(let N=Q,W=Q+I;N<W;N+=3)M(n[N+0],n[N+1],n[N+2])}const L=new P,R=new P,C=new P,V=new P;function S(b){C.fromArray(s,b*3),V.copy(C);const z=h[b];L.copy(z),L.sub(C.multiplyScalar(C.dot(z))).normalize(),R.crossVectors(V,z);const Q=R.dot(u[b])<0?-1:1;c[b*4]=L.x,c[b*4+1]=L.y,c[b*4+2]=L.z,c[b*4+3]=Q}for(let b=0,z=T.length;b<z;++b){const k=T[b],Q=k.start,I=k.count;for(let N=Q,W=Q+I;N<W;N+=3)S(n[N+0]),S(n[N+1]),S(n[N+2])}}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new $t(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let p=0,g=n.count;p<g;p++)n.setXYZ(p,0,0,0);const r=new P,s=new P,l=new P,o=new P,c=new P,h=new P,u=new P,d=new P;if(e)for(let p=0,g=e.count;p<g;p+=3){const v=e.getX(p+0),_=e.getX(p+1),m=e.getX(p+2);r.fromBufferAttribute(t,v),s.fromBufferAttribute(t,_),l.fromBufferAttribute(t,m),u.subVectors(l,s),d.subVectors(r,s),u.cross(d),o.fromBufferAttribute(n,v),c.fromBufferAttribute(n,_),h.fromBufferAttribute(n,m),o.add(u),c.add(u),h.add(u),n.setXYZ(v,o.x,o.y,o.z),n.setXYZ(_,c.x,c.y,c.z),n.setXYZ(m,h.x,h.y,h.z)}else for(let p=0,g=t.count;p<g;p+=3)r.fromBufferAttribute(t,p+0),s.fromBufferAttribute(t,p+1),l.fromBufferAttribute(t,p+2),u.subVectors(l,s),d.subVectors(r,s),u.cross(d),n.setXYZ(p+0,u.x,u.y,u.z),n.setXYZ(p+1,u.x,u.y,u.z),n.setXYZ(p+2,u.x,u.y,u.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)pt.fromBufferAttribute(e,t),pt.normalize(),e.setXYZ(t,pt.x,pt.y,pt.z)}toNonIndexed(){function e(o,c){const h=o.array,u=o.itemSize,d=o.normalized,p=new h.constructor(c.length*u);let g=0,v=0;for(let _=0,m=c.length;_<m;_++){o.isInterleavedBufferAttribute?g=c[_]*o.data.stride+o.offset:g=c[_]*u;for(let f=0;f<u;f++)p[v++]=h[g++]}return new $t(p,u,d)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new Zt,n=this.index.array,r=this.attributes;for(const o in r){const c=r[o],h=e(c,n);t.setAttribute(o,h)}const s=this.morphAttributes;for(const o in s){const c=[],h=s[o];for(let u=0,d=h.length;u<d;u++){const p=h[u],g=e(p,n);c.push(g)}t.morphAttributes[o]=c}t.morphTargetsRelative=this.morphTargetsRelative;const l=this.groups;for(let o=0,c=l.length;o<c;o++){const h=l[o];t.addGroup(h.start,h.count,h.materialIndex)}return t}toJSON(){const e={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){const c=this.parameters;for(const h in c)c[h]!==void 0&&(e[h]=c[h]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const n=this.attributes;for(const c in n){const h=n[c];e.data.attributes[c]=h.toJSON(e.data)}const r={};let s=!1;for(const c in this.morphAttributes){const h=this.morphAttributes[c],u=[];for(let d=0,p=h.length;d<p;d++){const g=h[d];u.push(g.toJSON(e.data))}u.length>0&&(r[c]=u,s=!0)}s&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);const l=this.groups;l.length>0&&(e.data.groups=JSON.parse(JSON.stringify(l)));const o=this.boundingSphere;return o!==null&&(e.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const n=e.index;n!==null&&this.setIndex(n.clone(t));const r=e.attributes;for(const h in r){const u=r[h];this.setAttribute(h,u.clone(t))}const s=e.morphAttributes;for(const h in s){const u=[],d=s[h];for(let p=0,g=d.length;p<g;p++)u.push(d[p].clone(t));this.morphAttributes[h]=u}this.morphTargetsRelative=e.morphTargetsRelative;const l=e.groups;for(let h=0,u=l.length;h<u;h++){const d=l[h];this.addGroup(d.start,d.count,d.materialIndex)}const o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());const c=e.boundingSphere;return c!==null&&(this.boundingSphere=c.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const Ka=new it,Vn=new Uc,wr=new ur,$a=new P,xi=new P,yi=new P,Si=new P,$s=new P,Rr=new P,Cr=new Re,Pr=new Re,Lr=new Re,Ja=new P,Za=new P,Qa=new P,Dr=new P,Ir=new P;class ce extends _t{constructor(e=new Zt,t=new vt){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const r=t[n[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,l=r.length;s<l;s++){const o=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}getVertexPosition(e,t){const n=this.geometry,r=n.attributes.position,s=n.morphAttributes.position,l=n.morphTargetsRelative;t.fromBufferAttribute(r,e);const o=this.morphTargetInfluences;if(s&&o){Rr.set(0,0,0);for(let c=0,h=s.length;c<h;c++){const u=o[c],d=s[c];u!==0&&($s.fromBufferAttribute(d,e),l?Rr.addScaledVector($s,u):Rr.addScaledVector($s.sub(t),u))}t.add(Rr)}return t}raycast(e,t){const n=this.geometry,r=this.material,s=this.matrixWorld;r!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),wr.copy(n.boundingSphere),wr.applyMatrix4(s),Vn.copy(e.ray).recast(e.near),!(wr.containsPoint(Vn.origin)===!1&&(Vn.intersectSphere(wr,$a)===null||Vn.origin.distanceToSquared($a)>(e.far-e.near)**2))&&(Ka.copy(s).invert(),Vn.copy(e.ray).applyMatrix4(Ka),!(n.boundingBox!==null&&Vn.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,Vn)))}_computeIntersections(e,t,n){let r;const s=this.geometry,l=this.material,o=s.index,c=s.attributes.position,h=s.attributes.uv,u=s.attributes.uv1,d=s.attributes.normal,p=s.groups,g=s.drawRange;if(o!==null)if(Array.isArray(l))for(let v=0,_=p.length;v<_;v++){const m=p[v],f=l[m.materialIndex],y=Math.max(m.start,g.start),M=Math.min(o.count,Math.min(m.start+m.count,g.start+g.count));for(let T=y,L=M;T<L;T+=3){const R=o.getX(T),C=o.getX(T+1),V=o.getX(T+2);r=Ur(this,f,e,n,h,u,d,R,C,V),r&&(r.faceIndex=Math.floor(T/3),r.face.materialIndex=m.materialIndex,t.push(r))}}else{const v=Math.max(0,g.start),_=Math.min(o.count,g.start+g.count);for(let m=v,f=_;m<f;m+=3){const y=o.getX(m),M=o.getX(m+1),T=o.getX(m+2);r=Ur(this,l,e,n,h,u,d,y,M,T),r&&(r.faceIndex=Math.floor(m/3),t.push(r))}}else if(c!==void 0)if(Array.isArray(l))for(let v=0,_=p.length;v<_;v++){const m=p[v],f=l[m.materialIndex],y=Math.max(m.start,g.start),M=Math.min(c.count,Math.min(m.start+m.count,g.start+g.count));for(let T=y,L=M;T<L;T+=3){const R=T,C=T+1,V=T+2;r=Ur(this,f,e,n,h,u,d,R,C,V),r&&(r.faceIndex=Math.floor(T/3),r.face.materialIndex=m.materialIndex,t.push(r))}}else{const v=Math.max(0,g.start),_=Math.min(c.count,g.start+g.count);for(let m=v,f=_;m<f;m+=3){const y=m,M=m+1,T=m+2;r=Ur(this,l,e,n,h,u,d,y,M,T),r&&(r.faceIndex=Math.floor(m/3),t.push(r))}}}}function Hu(i,e,t,n,r,s,l,o){let c;if(e.side===Ut?c=n.intersectTriangle(l,s,r,!0,o):c=n.intersectTriangle(r,s,l,e.side===Fn,o),c===null)return null;Ir.copy(o),Ir.applyMatrix4(i.matrixWorld);const h=t.ray.origin.distanceTo(Ir);return h<t.near||h>t.far?null:{distance:h,point:Ir.clone(),object:i}}function Ur(i,e,t,n,r,s,l,o,c,h){i.getVertexPosition(o,xi),i.getVertexPosition(c,yi),i.getVertexPosition(h,Si);const u=Hu(i,e,t,n,xi,yi,Si,Dr);if(u){r&&(Cr.fromBufferAttribute(r,o),Pr.fromBufferAttribute(r,c),Lr.fromBufferAttribute(r,h),u.uv=Xt.getInterpolation(Dr,xi,yi,Si,Cr,Pr,Lr,new Re)),s&&(Cr.fromBufferAttribute(s,o),Pr.fromBufferAttribute(s,c),Lr.fromBufferAttribute(s,h),u.uv1=Xt.getInterpolation(Dr,xi,yi,Si,Cr,Pr,Lr,new Re),u.uv2=u.uv1),l&&(Ja.fromBufferAttribute(l,o),Za.fromBufferAttribute(l,c),Qa.fromBufferAttribute(l,h),u.normal=Xt.getInterpolation(Dr,xi,yi,Si,Ja,Za,Qa,new P),u.normal.dot(n.direction)>0&&u.normal.multiplyScalar(-1));const d={a:o,b:c,c:h,normal:new P,materialIndex:0};Xt.getNormal(xi,yi,Si,d.normal),u.face=d}return u}class Xe extends Zt{constructor(e=1,t=1,n=1,r=1,s=1,l=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:r,heightSegments:s,depthSegments:l};const o=this;r=Math.floor(r),s=Math.floor(s),l=Math.floor(l);const c=[],h=[],u=[],d=[];let p=0,g=0;v("z","y","x",-1,-1,n,t,e,l,s,0),v("z","y","x",1,-1,n,t,-e,l,s,1),v("x","z","y",1,1,e,n,t,r,l,2),v("x","z","y",1,-1,e,n,-t,r,l,3),v("x","y","z",1,-1,e,t,n,r,s,4),v("x","y","z",-1,-1,e,t,-n,r,s,5),this.setIndex(c),this.setAttribute("position",new ct(h,3)),this.setAttribute("normal",new ct(u,3)),this.setAttribute("uv",new ct(d,2));function v(_,m,f,y,M,T,L,R,C,V,S){const b=T/C,z=L/V,k=T/2,Q=L/2,I=R/2,N=C+1,W=V+1;let j=0,q=0;const Y=new P;for(let K=0;K<W;K++){const ne=K*z-Q;for(let ie=0;ie<N;ie++){const X=ie*b-k;Y[_]=X*y,Y[m]=ne*M,Y[f]=I,h.push(Y.x,Y.y,Y.z),Y[_]=0,Y[m]=0,Y[f]=R>0?1:-1,u.push(Y.x,Y.y,Y.z),d.push(ie/C),d.push(1-K/V),j+=1}}for(let K=0;K<V;K++)for(let ne=0;ne<C;ne++){const ie=p+ne+N*K,X=p+ne+N*(K+1),$=p+(ne+1)+N*(K+1),he=p+(ne+1)+N*K;c.push(ie,X,he),c.push(X,$,he),q+=6}o.addGroup(g,q,S),g+=q,p+=j}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Xe(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}function Hi(i){const e={};for(const t in i){e[t]={};for(const n in i[t]){const r=i[t][n];r&&(r.isColor||r.isMatrix3||r.isMatrix4||r.isVector2||r.isVector3||r.isVector4||r.isTexture||r.isQuaternion)?r.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=r.clone():Array.isArray(r)?e[t][n]=r.slice():e[t][n]=r}}return e}function Ct(i){const e={};for(let t=0;t<i.length;t++){const n=Hi(i[t]);for(const r in n)e[r]=n[r]}return e}function Vu(i){const e=[];for(let t=0;t<i.length;t++)e.push(i[t].clone());return e}function Bc(i){return i.getRenderTarget()===null?i.outputColorSpace:Ke.workingColorSpace}const Wu={clone:Hi,merge:Ct};var Xu=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,qu=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class ri extends ci{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Xu,this.fragmentShader=qu,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={derivatives:!1,fragDepth:!1,drawBuffers:!1,shaderTextureLOD:!1,clipCullDistance:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Hi(e.uniforms),this.uniformsGroups=Vu(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const r in this.uniforms){const l=this.uniforms[r].value;l&&l.isTexture?t.uniforms[r]={type:"t",value:l.toJSON(e).uuid}:l&&l.isColor?t.uniforms[r]={type:"c",value:l.getHex()}:l&&l.isVector2?t.uniforms[r]={type:"v2",value:l.toArray()}:l&&l.isVector3?t.uniforms[r]={type:"v3",value:l.toArray()}:l&&l.isVector4?t.uniforms[r]={type:"v4",value:l.toArray()}:l&&l.isMatrix3?t.uniforms[r]={type:"m3",value:l.toArray()}:l&&l.isMatrix4?t.uniforms[r]={type:"m4",value:l.toArray()}:t.uniforms[r]={value:l}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const n={};for(const r in this.extensions)this.extensions[r]===!0&&(n[r]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}}class Gc extends _t{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new it,this.projectionMatrix=new it,this.projectionMatrixInverse=new it,this.coordinateSystem=vn}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}class qt extends Gc{constructor(e=50,t=1,n=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=Ro*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(Is*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Ro*2*Math.atan(Math.tan(Is*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}setViewOffset(e,t,n,r,s,l){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=s,this.view.height=l,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(Is*.5*this.fov)/this.zoom,n=2*t,r=this.aspect*n,s=-.5*r;const l=this.view;if(this.view!==null&&this.view.enabled){const c=l.fullWidth,h=l.fullHeight;s+=l.offsetX*r/c,t-=l.offsetY*n/h,r*=l.width/c,n*=l.height/h}const o=this.filmOffset;o!==0&&(s+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+r,t,t-n,e,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}const Ei=-90,Ti=1;class Yu extends _t{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const r=new qt(Ei,Ti,e,t);r.layers=this.layers,this.add(r);const s=new qt(Ei,Ti,e,t);s.layers=this.layers,this.add(s);const l=new qt(Ei,Ti,e,t);l.layers=this.layers,this.add(l);const o=new qt(Ei,Ti,e,t);o.layers=this.layers,this.add(o);const c=new qt(Ei,Ti,e,t);c.layers=this.layers,this.add(c);const h=new qt(Ei,Ti,e,t);h.layers=this.layers,this.add(h)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[n,r,s,l,o,c]=t;for(const h of t)this.remove(h);if(e===vn)n.up.set(0,1,0),n.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),l.up.set(0,0,1),l.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),c.up.set(0,1,0),c.lookAt(0,0,-1);else if(e===rs)n.up.set(0,-1,0),n.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),l.up.set(0,0,-1),l.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),c.up.set(0,-1,0),c.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const h of t)this.add(h),h.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[s,l,o,c,h,u]=this.children,d=e.getRenderTarget(),p=e.getActiveCubeFace(),g=e.getActiveMipmapLevel(),v=e.xr.enabled;e.xr.enabled=!1;const _=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,e.setRenderTarget(n,0,r),e.render(t,s),e.setRenderTarget(n,1,r),e.render(t,l),e.setRenderTarget(n,2,r),e.render(t,o),e.setRenderTarget(n,3,r),e.render(t,c),e.setRenderTarget(n,4,r),e.render(t,h),n.texture.generateMipmaps=_,e.setRenderTarget(n,5,r),e.render(t,u),e.setRenderTarget(d,p,g),e.xr.enabled=v,n.texture.needsPMREMUpdate=!0}}class zc extends Nt{constructor(e,t,n,r,s,l,o,c,h,u){e=e!==void 0?e:[],t=t!==void 0?t:Gi,super(e,t,n,r,s,l,o,c,h,u),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class ju extends ii{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const n={width:e,height:e,depth:1},r=[n,n,n,n,n,n];t.encoding!==void 0&&(ir("THREE.WebGLCubeRenderTarget: option.encoding has been replaced by option.colorSpace."),t.colorSpace=t.encoding===ti?Mt:Kt),this.texture=new zc(r,t.mapping,t.wrapS,t.wrapT,t.magFilter,t.minFilter,t.format,t.type,t.anisotropy,t.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=t.generateMipmaps!==void 0?t.generateMipmaps:!1,this.texture.minFilter=t.minFilter!==void 0?t.minFilter:Wt}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new Xe(5,5,5),s=new ri({name:"CubemapFromEquirect",uniforms:Hi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Ut,blending:In});s.uniforms.tEquirect.value=t;const l=new ce(r,s),o=t.minFilter;return t.minFilter===sr&&(t.minFilter=Wt),new Yu(1,10,this).update(e,l),t.minFilter=o,l.geometry.dispose(),l.material.dispose(),this}clear(e,t,n,r){const s=e.getRenderTarget();for(let l=0;l<6;l++)e.setRenderTarget(this,l),e.clear(t,n,r);e.setRenderTarget(s)}}const Js=new P,Ku=new P,$u=new He;class Kn{constructor(e=new P(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,r){return this.normal.set(e,t,n),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){const r=Js.subVectors(n,t).cross(Ku.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){const n=e.delta(Js),r=this.normal.dot(n);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const s=-(e.start.dot(this.normal)+this.constant)/r;return s<0||s>1?null:t.copy(e.start).addScaledVector(n,s)}intersectsLine(e){const t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const n=t||$u.getNormalMatrix(e),r=this.coplanarPoint(Js).applyMatrix4(e),s=this.normal.applyMatrix3(n).normalize();return this.constant=-r.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Wn=new ur,Nr=new P;class ko{constructor(e=new Kn,t=new Kn,n=new Kn,r=new Kn,s=new Kn,l=new Kn){this.planes=[e,t,n,r,s,l]}set(e,t,n,r,s,l){const o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(r),o[4].copy(s),o[5].copy(l),this}copy(e){const t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=vn){const n=this.planes,r=e.elements,s=r[0],l=r[1],o=r[2],c=r[3],h=r[4],u=r[5],d=r[6],p=r[7],g=r[8],v=r[9],_=r[10],m=r[11],f=r[12],y=r[13],M=r[14],T=r[15];if(n[0].setComponents(c-s,p-h,m-g,T-f).normalize(),n[1].setComponents(c+s,p+h,m+g,T+f).normalize(),n[2].setComponents(c+l,p+u,m+v,T+y).normalize(),n[3].setComponents(c-l,p-u,m-v,T-y).normalize(),n[4].setComponents(c-o,p-d,m-_,T-M).normalize(),t===vn)n[5].setComponents(c+o,p+d,m+_,T+M).normalize();else if(t===rs)n[5].setComponents(o,d,_,M).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Wn.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Wn.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Wn)}intersectsSprite(e){return Wn.center.set(0,0,0),Wn.radius=.7071067811865476,Wn.applyMatrix4(e.matrixWorld),this.intersectsSphere(Wn)}intersectsSphere(e){const t=this.planes,n=e.center,r=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(n)<r)return!1;return!0}intersectsBox(e){const t=this.planes;for(let n=0;n<6;n++){const r=t[n];if(Nr.x=r.normal.x>0?e.max.x:e.min.x,Nr.y=r.normal.y>0?e.max.y:e.min.y,Nr.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(Nr)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function kc(){let i=null,e=!1,t=null,n=null;function r(s,l){t(s,l),n=i.requestAnimationFrame(r)}return{start:function(){e!==!0&&t!==null&&(n=i.requestAnimationFrame(r),e=!0)},stop:function(){i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){i=s}}}function Ju(i,e){const t=e.isWebGL2,n=new WeakMap;function r(h,u){const d=h.array,p=h.usage,g=d.byteLength,v=i.createBuffer();i.bindBuffer(u,v),i.bufferData(u,d,p),h.onUploadCallback();let _;if(d instanceof Float32Array)_=i.FLOAT;else if(d instanceof Uint16Array)if(h.isFloat16BufferAttribute)if(t)_=i.HALF_FLOAT;else throw new Error("THREE.WebGLAttributes: Usage of Float16BufferAttribute requires WebGL2.");else _=i.UNSIGNED_SHORT;else if(d instanceof Int16Array)_=i.SHORT;else if(d instanceof Uint32Array)_=i.UNSIGNED_INT;else if(d instanceof Int32Array)_=i.INT;else if(d instanceof Int8Array)_=i.BYTE;else if(d instanceof Uint8Array)_=i.UNSIGNED_BYTE;else if(d instanceof Uint8ClampedArray)_=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+d);return{buffer:v,type:_,bytesPerElement:d.BYTES_PER_ELEMENT,version:h.version,size:g}}function s(h,u,d){const p=u.array,g=u._updateRange,v=u.updateRanges;if(i.bindBuffer(d,h),g.count===-1&&v.length===0&&i.bufferSubData(d,0,p),v.length!==0){for(let _=0,m=v.length;_<m;_++){const f=v[_];t?i.bufferSubData(d,f.start*p.BYTES_PER_ELEMENT,p,f.start,f.count):i.bufferSubData(d,f.start*p.BYTES_PER_ELEMENT,p.subarray(f.start,f.start+f.count))}u.clearUpdateRanges()}g.count!==-1&&(t?i.bufferSubData(d,g.offset*p.BYTES_PER_ELEMENT,p,g.offset,g.count):i.bufferSubData(d,g.offset*p.BYTES_PER_ELEMENT,p.subarray(g.offset,g.offset+g.count)),g.count=-1),u.onUploadCallback()}function l(h){return h.isInterleavedBufferAttribute&&(h=h.data),n.get(h)}function o(h){h.isInterleavedBufferAttribute&&(h=h.data);const u=n.get(h);u&&(i.deleteBuffer(u.buffer),n.delete(h))}function c(h,u){if(h.isGLBufferAttribute){const p=n.get(h);(!p||p.version<h.version)&&n.set(h,{buffer:h.buffer,type:h.type,bytesPerElement:h.elementSize,version:h.version});return}h.isInterleavedBufferAttribute&&(h=h.data);const d=n.get(h);if(d===void 0)n.set(h,r(h,u));else if(d.version<h.version){if(d.size!==h.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");s(d.buffer,h,u),d.version=h.version}}return{get:l,remove:o,update:c}}class si extends Zt{constructor(e=1,t=1,n=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:r};const s=e/2,l=t/2,o=Math.floor(n),c=Math.floor(r),h=o+1,u=c+1,d=e/o,p=t/c,g=[],v=[],_=[],m=[];for(let f=0;f<u;f++){const y=f*p-l;for(let M=0;M<h;M++){const T=M*d-s;v.push(T,-y,0),_.push(0,0,1),m.push(M/o),m.push(1-f/c)}}for(let f=0;f<c;f++)for(let y=0;y<o;y++){const M=y+h*f,T=y+h*(f+1),L=y+1+h*(f+1),R=y+1+h*f;g.push(M,T,R),g.push(T,L,R)}this.setIndex(g),this.setAttribute("position",new ct(v,3)),this.setAttribute("normal",new ct(_,3)),this.setAttribute("uv",new ct(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new si(e.width,e.height,e.widthSegments,e.heightSegments)}}var Zu=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Qu=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,ed=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,td=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,nd=`#ifdef USE_ALPHATEST
	if ( diffuseColor.a < alphaTest ) discard;
#endif`,id=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,rd=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,sd=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,od=`#ifdef USE_BATCHING
	attribute float batchId;
	uniform highp sampler2D batchingTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,ad=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( batchId );
#endif`,ld=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,cd=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,hd=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,ud=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,dd=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,fd=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#pragma unroll_loop_start
	for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
		plane = clippingPlanes[ i ];
		if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
	}
	#pragma unroll_loop_end
	#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
		bool clipped = true;
		#pragma unroll_loop_start
		for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
		}
		#pragma unroll_loop_end
		if ( clipped ) discard;
	#endif
#endif`,pd=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,md=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,gd=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,_d=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,vd=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,Md=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	varying vec3 vColor;
#endif`,xd=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif`,yd=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
float luminance( const in vec3 rgb ) {
	const vec3 weights = vec3( 0.2126729, 0.7151522, 0.0721750 );
	return dot( weights, rgb );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Sd=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Ed=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,Td=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,bd=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Ad=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,wd=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Rd="gl_FragColor = linearToOutputTexel( gl_FragColor );",Cd=`
const mat3 LINEAR_SRGB_TO_LINEAR_DISPLAY_P3 = mat3(
	vec3( 0.8224621, 0.177538, 0.0 ),
	vec3( 0.0331941, 0.9668058, 0.0 ),
	vec3( 0.0170827, 0.0723974, 0.9105199 )
);
const mat3 LINEAR_DISPLAY_P3_TO_LINEAR_SRGB = mat3(
	vec3( 1.2249401, - 0.2249404, 0.0 ),
	vec3( - 0.0420569, 1.0420571, 0.0 ),
	vec3( - 0.0196376, - 0.0786361, 1.0982735 )
);
vec4 LinearSRGBToLinearDisplayP3( in vec4 value ) {
	return vec4( value.rgb * LINEAR_SRGB_TO_LINEAR_DISPLAY_P3, value.a );
}
vec4 LinearDisplayP3ToLinearSRGB( in vec4 value ) {
	return vec4( value.rgb * LINEAR_DISPLAY_P3_TO_LINEAR_SRGB, value.a );
}
vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
vec4 LinearToLinear( in vec4 value ) {
	return value;
}
vec4 LinearTosRGB( in vec4 value ) {
	return sRGBTransferOETF( value );
}`,Pd=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,Ld=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,Dd=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Id=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Ud=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Nd=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Od=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Fd=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Bd=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Gd=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,zd=`#ifdef USE_LIGHTMAP
	vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
	vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
	reflectedLight.indirectDiffuse += lightMapIrradiance;
#endif`,kd=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Hd=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Vd=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Wd=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	#if defined ( LEGACY_LIGHTS )
		if ( cutoffDistance > 0.0 && decayExponent > 0.0 ) {
			return pow( saturate( - lightDistance / cutoffDistance + 1.0 ), decayExponent );
		}
		return 1.0;
	#else
		float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
		if ( cutoffDistance > 0.0 ) {
			distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
		}
		return distanceFalloff;
	#endif
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,Xd=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,qd=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Yd=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,jd=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Kd=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,$d=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Jd=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Zd=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Qd=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,ef=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,tf=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,nf=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,rf=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		varying float vFragDepth;
		varying float vIsPerspective;
	#else
		uniform float logDepthBufFC;
	#endif
#endif`,sf=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		vFragDepth = 1.0 + gl_Position.w;
		vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
	#else
		if ( isPerspectiveMatrix( projectionMatrix ) ) {
			gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;
			gl_Position.z *= gl_Position.w;
		}
	#endif
#endif`,of=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
	
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,af=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,lf=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,cf=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,hf=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,uf=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,df=`#if defined( USE_MORPHCOLORS ) && defined( MORPHTARGETS_TEXTURE )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,ff=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
			if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
		}
	#else
		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];
		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];
		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];
		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];
	#endif
#endif`,pf=`#ifdef USE_MORPHTARGETS
	uniform float morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
		uniform sampler2DArray morphTargetsTexture;
		uniform ivec2 morphTargetsTextureSize;
		vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
			int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
			int y = texelIndex / morphTargetsTextureSize.x;
			int x = texelIndex - y * morphTargetsTextureSize.x;
			ivec3 morphUV = ivec3( x, y, morphTargetIndex );
			return texelFetch( morphTargetsTexture, morphUV, 0 );
		}
	#else
		#ifndef USE_MORPHNORMALS
			uniform float morphTargetInfluences[ 8 ];
		#else
			uniform float morphTargetInfluences[ 4 ];
		#endif
	#endif
#endif`,mf=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	#ifdef MORPHTARGETS_TEXTURE
		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
			if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
		}
	#else
		transformed += morphTarget0 * morphTargetInfluences[ 0 ];
		transformed += morphTarget1 * morphTargetInfluences[ 1 ];
		transformed += morphTarget2 * morphTargetInfluences[ 2 ];
		transformed += morphTarget3 * morphTargetInfluences[ 3 ];
		#ifndef USE_MORPHNORMALS
			transformed += morphTarget4 * morphTargetInfluences[ 4 ];
			transformed += morphTarget5 * morphTargetInfluences[ 5 ];
			transformed += morphTarget6 * morphTargetInfluences[ 6 ];
			transformed += morphTarget7 * morphTargetInfluences[ 7 ];
		#endif
	#endif
#endif`,gf=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,_f=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,vf=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Mf=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,xf=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,yf=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Sf=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Ef=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Tf=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,bf=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Af=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,wf=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;
const vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256., 256. );
const vec4 UnpackFactors = UnpackDownscale / vec4( PackFactors, 1. );
const float ShiftRight8 = 1. / 256.;
vec4 packDepthToRGBA( const in float v ) {
	vec4 r = vec4( fract( v * PackFactors ), v );
	r.yzw -= r.xyz * ShiftRight8;	return r * PackUpscale;
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors );
}
vec2 packDepthToRG( in highp float v ) {
	return packDepthToRGBA( v ).yx;
}
float unpackRGToDepth( const in highp vec2 v ) {
	return unpackRGBAToDepth( vec4( v.xy, 0.0, 0.0 ) );
}
vec4 pack2HalfToRGBA( vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,Rf=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Cf=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Pf=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Lf=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Df=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,If=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Uf=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return shadow;
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
		vec3 lightToPosition = shadowCoord.xyz;
		float dp = ( length( lightToPosition ) - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );		dp += shadowBias;
		vec3 bd3D = normalize( lightToPosition );
		#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
			vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
			return (
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
			) * ( 1.0 / 9.0 );
		#else
			return texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
		#endif
	}
#endif`,Nf=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Of=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Ff=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Bf=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Gf=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,zf=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,kf=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Hf=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Vf=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Wf=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Xf=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 OptimizedCineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color *= toneMappingExposure;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	return color;
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,qf=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Yf=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
		vec3 refractedRayExit = position + transmissionRay;
		vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
		vec2 refractionCoords = ndcPos.xy / ndcPos.w;
		refractionCoords += 1.0;
		refractionCoords /= 2.0;
		vec4 transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
		vec3 transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,jf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Kf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,$f=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Jf=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Zf=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Qf=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,ep=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,tp=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,np=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,ip=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,rp=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,sp=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#endif
}`,op=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,ap=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,lp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,cp=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,hp=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,up=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,dp=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,fp=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,pp=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,mp=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,gp=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,_p=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,vp=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Mp=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), opacity );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,xp=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,yp=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Sp=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Ep=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Tp=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,bp=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ap=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,wp=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Rp=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Cp=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Pp=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec2 scale;
	scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );
	scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Lp=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Oe={alphahash_fragment:Zu,alphahash_pars_fragment:Qu,alphamap_fragment:ed,alphamap_pars_fragment:td,alphatest_fragment:nd,alphatest_pars_fragment:id,aomap_fragment:rd,aomap_pars_fragment:sd,batching_pars_vertex:od,batching_vertex:ad,begin_vertex:ld,beginnormal_vertex:cd,bsdfs:hd,iridescence_fragment:ud,bumpmap_pars_fragment:dd,clipping_planes_fragment:fd,clipping_planes_pars_fragment:pd,clipping_planes_pars_vertex:md,clipping_planes_vertex:gd,color_fragment:_d,color_pars_fragment:vd,color_pars_vertex:Md,color_vertex:xd,common:yd,cube_uv_reflection_fragment:Sd,defaultnormal_vertex:Ed,displacementmap_pars_vertex:Td,displacementmap_vertex:bd,emissivemap_fragment:Ad,emissivemap_pars_fragment:wd,colorspace_fragment:Rd,colorspace_pars_fragment:Cd,envmap_fragment:Pd,envmap_common_pars_fragment:Ld,envmap_pars_fragment:Dd,envmap_pars_vertex:Id,envmap_physical_pars_fragment:Xd,envmap_vertex:Ud,fog_vertex:Nd,fog_pars_vertex:Od,fog_fragment:Fd,fog_pars_fragment:Bd,gradientmap_pars_fragment:Gd,lightmap_fragment:zd,lightmap_pars_fragment:kd,lights_lambert_fragment:Hd,lights_lambert_pars_fragment:Vd,lights_pars_begin:Wd,lights_toon_fragment:qd,lights_toon_pars_fragment:Yd,lights_phong_fragment:jd,lights_phong_pars_fragment:Kd,lights_physical_fragment:$d,lights_physical_pars_fragment:Jd,lights_fragment_begin:Zd,lights_fragment_maps:Qd,lights_fragment_end:ef,logdepthbuf_fragment:tf,logdepthbuf_pars_fragment:nf,logdepthbuf_pars_vertex:rf,logdepthbuf_vertex:sf,map_fragment:of,map_pars_fragment:af,map_particle_fragment:lf,map_particle_pars_fragment:cf,metalnessmap_fragment:hf,metalnessmap_pars_fragment:uf,morphcolor_vertex:df,morphnormal_vertex:ff,morphtarget_pars_vertex:pf,morphtarget_vertex:mf,normal_fragment_begin:gf,normal_fragment_maps:_f,normal_pars_fragment:vf,normal_pars_vertex:Mf,normal_vertex:xf,normalmap_pars_fragment:yf,clearcoat_normal_fragment_begin:Sf,clearcoat_normal_fragment_maps:Ef,clearcoat_pars_fragment:Tf,iridescence_pars_fragment:bf,opaque_fragment:Af,packing:wf,premultiplied_alpha_fragment:Rf,project_vertex:Cf,dithering_fragment:Pf,dithering_pars_fragment:Lf,roughnessmap_fragment:Df,roughnessmap_pars_fragment:If,shadowmap_pars_fragment:Uf,shadowmap_pars_vertex:Nf,shadowmap_vertex:Of,shadowmask_pars_fragment:Ff,skinbase_vertex:Bf,skinning_pars_vertex:Gf,skinning_vertex:zf,skinnormal_vertex:kf,specularmap_fragment:Hf,specularmap_pars_fragment:Vf,tonemapping_fragment:Wf,tonemapping_pars_fragment:Xf,transmission_fragment:qf,transmission_pars_fragment:Yf,uv_pars_fragment:jf,uv_pars_vertex:Kf,uv_vertex:$f,worldpos_vertex:Jf,background_vert:Zf,background_frag:Qf,backgroundCube_vert:ep,backgroundCube_frag:tp,cube_vert:np,cube_frag:ip,depth_vert:rp,depth_frag:sp,distanceRGBA_vert:op,distanceRGBA_frag:ap,equirect_vert:lp,equirect_frag:cp,linedashed_vert:hp,linedashed_frag:up,meshbasic_vert:dp,meshbasic_frag:fp,meshlambert_vert:pp,meshlambert_frag:mp,meshmatcap_vert:gp,meshmatcap_frag:_p,meshnormal_vert:vp,meshnormal_frag:Mp,meshphong_vert:xp,meshphong_frag:yp,meshphysical_vert:Sp,meshphysical_frag:Ep,meshtoon_vert:Tp,meshtoon_frag:bp,points_vert:Ap,points_frag:wp,shadow_vert:Rp,shadow_frag:Cp,sprite_vert:Pp,sprite_frag:Lp},se={common:{diffuse:{value:new We(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new He},alphaMap:{value:null},alphaMapTransform:{value:new He},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new He}},envmap:{envMap:{value:null},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new He}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new He}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new He},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new He},normalScale:{value:new Re(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new He},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new He}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new He}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new He}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new We(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new We(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new He},alphaTest:{value:0},uvTransform:{value:new He}},sprite:{diffuse:{value:new We(16777215)},opacity:{value:1},center:{value:new Re(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new He},alphaMap:{value:null},alphaMapTransform:{value:new He},alphaTest:{value:0}}},cn={basic:{uniforms:Ct([se.common,se.specularmap,se.envmap,se.aomap,se.lightmap,se.fog]),vertexShader:Oe.meshbasic_vert,fragmentShader:Oe.meshbasic_frag},lambert:{uniforms:Ct([se.common,se.specularmap,se.envmap,se.aomap,se.lightmap,se.emissivemap,se.bumpmap,se.normalmap,se.displacementmap,se.fog,se.lights,{emissive:{value:new We(0)}}]),vertexShader:Oe.meshlambert_vert,fragmentShader:Oe.meshlambert_frag},phong:{uniforms:Ct([se.common,se.specularmap,se.envmap,se.aomap,se.lightmap,se.emissivemap,se.bumpmap,se.normalmap,se.displacementmap,se.fog,se.lights,{emissive:{value:new We(0)},specular:{value:new We(1118481)},shininess:{value:30}}]),vertexShader:Oe.meshphong_vert,fragmentShader:Oe.meshphong_frag},standard:{uniforms:Ct([se.common,se.envmap,se.aomap,se.lightmap,se.emissivemap,se.bumpmap,se.normalmap,se.displacementmap,se.roughnessmap,se.metalnessmap,se.fog,se.lights,{emissive:{value:new We(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Oe.meshphysical_vert,fragmentShader:Oe.meshphysical_frag},toon:{uniforms:Ct([se.common,se.aomap,se.lightmap,se.emissivemap,se.bumpmap,se.normalmap,se.displacementmap,se.gradientmap,se.fog,se.lights,{emissive:{value:new We(0)}}]),vertexShader:Oe.meshtoon_vert,fragmentShader:Oe.meshtoon_frag},matcap:{uniforms:Ct([se.common,se.bumpmap,se.normalmap,se.displacementmap,se.fog,{matcap:{value:null}}]),vertexShader:Oe.meshmatcap_vert,fragmentShader:Oe.meshmatcap_frag},points:{uniforms:Ct([se.points,se.fog]),vertexShader:Oe.points_vert,fragmentShader:Oe.points_frag},dashed:{uniforms:Ct([se.common,se.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Oe.linedashed_vert,fragmentShader:Oe.linedashed_frag},depth:{uniforms:Ct([se.common,se.displacementmap]),vertexShader:Oe.depth_vert,fragmentShader:Oe.depth_frag},normal:{uniforms:Ct([se.common,se.bumpmap,se.normalmap,se.displacementmap,{opacity:{value:1}}]),vertexShader:Oe.meshnormal_vert,fragmentShader:Oe.meshnormal_frag},sprite:{uniforms:Ct([se.sprite,se.fog]),vertexShader:Oe.sprite_vert,fragmentShader:Oe.sprite_frag},background:{uniforms:{uvTransform:{value:new He},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Oe.background_vert,fragmentShader:Oe.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1}},vertexShader:Oe.backgroundCube_vert,fragmentShader:Oe.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Oe.cube_vert,fragmentShader:Oe.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Oe.equirect_vert,fragmentShader:Oe.equirect_frag},distanceRGBA:{uniforms:Ct([se.common,se.displacementmap,{referencePosition:{value:new P},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Oe.distanceRGBA_vert,fragmentShader:Oe.distanceRGBA_frag},shadow:{uniforms:Ct([se.lights,se.fog,{color:{value:new We(0)},opacity:{value:1}}]),vertexShader:Oe.shadow_vert,fragmentShader:Oe.shadow_frag}};cn.physical={uniforms:Ct([cn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new He},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new He},clearcoatNormalScale:{value:new Re(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new He},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new He},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new He},sheen:{value:0},sheenColor:{value:new We(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new He},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new He},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new He},transmissionSamplerSize:{value:new Re},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new He},attenuationDistance:{value:0},attenuationColor:{value:new We(0)},specularColor:{value:new We(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new He},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new He},anisotropyVector:{value:new Re},anisotropyMap:{value:null},anisotropyMapTransform:{value:new He}}]),vertexShader:Oe.meshphysical_vert,fragmentShader:Oe.meshphysical_frag};const Or={r:0,b:0,g:0};function Dp(i,e,t,n,r,s,l){const o=new We(0);let c=s===!0?0:1,h,u,d=null,p=0,g=null;function v(m,f){let y=!1,M=f.isScene===!0?f.background:null;M&&M.isTexture&&(M=(f.backgroundBlurriness>0?t:e).get(M)),M===null?_(o,c):M&&M.isColor&&(_(M,1),y=!0);const T=i.xr.getEnvironmentBlendMode();T==="additive"?n.buffers.color.setClear(0,0,0,1,l):T==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,l),(i.autoClear||y)&&i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil),M&&(M.isCubeTexture||M.mapping===ms)?(u===void 0&&(u=new ce(new Xe(1,1,1),new ri({name:"BackgroundCubeMaterial",uniforms:Hi(cn.backgroundCube.uniforms),vertexShader:cn.backgroundCube.vertexShader,fragmentShader:cn.backgroundCube.fragmentShader,side:Ut,depthTest:!1,depthWrite:!1,fog:!1})),u.geometry.deleteAttribute("normal"),u.geometry.deleteAttribute("uv"),u.onBeforeRender=function(L,R,C){this.matrixWorld.copyPosition(C.matrixWorld)},Object.defineProperty(u.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(u)),u.material.uniforms.envMap.value=M,u.material.uniforms.flipEnvMap.value=M.isCubeTexture&&M.isRenderTargetTexture===!1?-1:1,u.material.uniforms.backgroundBlurriness.value=f.backgroundBlurriness,u.material.uniforms.backgroundIntensity.value=f.backgroundIntensity,u.material.toneMapped=Ke.getTransfer(M.colorSpace)!==et,(d!==M||p!==M.version||g!==i.toneMapping)&&(u.material.needsUpdate=!0,d=M,p=M.version,g=i.toneMapping),u.layers.enableAll(),m.unshift(u,u.geometry,u.material,0,0,null)):M&&M.isTexture&&(h===void 0&&(h=new ce(new si(2,2),new ri({name:"BackgroundMaterial",uniforms:Hi(cn.background.uniforms),vertexShader:cn.background.vertexShader,fragmentShader:cn.background.fragmentShader,side:Fn,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),Object.defineProperty(h.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(h)),h.material.uniforms.t2D.value=M,h.material.uniforms.backgroundIntensity.value=f.backgroundIntensity,h.material.toneMapped=Ke.getTransfer(M.colorSpace)!==et,M.matrixAutoUpdate===!0&&M.updateMatrix(),h.material.uniforms.uvTransform.value.copy(M.matrix),(d!==M||p!==M.version||g!==i.toneMapping)&&(h.material.needsUpdate=!0,d=M,p=M.version,g=i.toneMapping),h.layers.enableAll(),m.unshift(h,h.geometry,h.material,0,0,null))}function _(m,f){m.getRGB(Or,Bc(i)),n.buffers.color.setClear(Or.r,Or.g,Or.b,f,l)}return{getClearColor:function(){return o},setClearColor:function(m,f=1){o.set(m),c=f,_(o,c)},getClearAlpha:function(){return c},setClearAlpha:function(m){c=m,_(o,c)},render:v}}function Ip(i,e,t,n){const r=i.getParameter(i.MAX_VERTEX_ATTRIBS),s=n.isWebGL2?null:e.get("OES_vertex_array_object"),l=n.isWebGL2||s!==null,o={},c=m(null);let h=c,u=!1;function d(I,N,W,j,q){let Y=!1;if(l){const K=_(j,W,N);h!==K&&(h=K,g(h.object)),Y=f(I,j,W,q),Y&&y(I,j,W,q)}else{const K=N.wireframe===!0;(h.geometry!==j.id||h.program!==W.id||h.wireframe!==K)&&(h.geometry=j.id,h.program=W.id,h.wireframe=K,Y=!0)}q!==null&&t.update(q,i.ELEMENT_ARRAY_BUFFER),(Y||u)&&(u=!1,V(I,N,W,j),q!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get(q).buffer))}function p(){return n.isWebGL2?i.createVertexArray():s.createVertexArrayOES()}function g(I){return n.isWebGL2?i.bindVertexArray(I):s.bindVertexArrayOES(I)}function v(I){return n.isWebGL2?i.deleteVertexArray(I):s.deleteVertexArrayOES(I)}function _(I,N,W){const j=W.wireframe===!0;let q=o[I.id];q===void 0&&(q={},o[I.id]=q);let Y=q[N.id];Y===void 0&&(Y={},q[N.id]=Y);let K=Y[j];return K===void 0&&(K=m(p()),Y[j]=K),K}function m(I){const N=[],W=[],j=[];for(let q=0;q<r;q++)N[q]=0,W[q]=0,j[q]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:N,enabledAttributes:W,attributeDivisors:j,object:I,attributes:{},index:null}}function f(I,N,W,j){const q=h.attributes,Y=N.attributes;let K=0;const ne=W.getAttributes();for(const ie in ne)if(ne[ie].location>=0){const $=q[ie];let he=Y[ie];if(he===void 0&&(ie==="instanceMatrix"&&I.instanceMatrix&&(he=I.instanceMatrix),ie==="instanceColor"&&I.instanceColor&&(he=I.instanceColor)),$===void 0||$.attribute!==he||he&&$.data!==he.data)return!0;K++}return h.attributesNum!==K||h.index!==j}function y(I,N,W,j){const q={},Y=N.attributes;let K=0;const ne=W.getAttributes();for(const ie in ne)if(ne[ie].location>=0){let $=Y[ie];$===void 0&&(ie==="instanceMatrix"&&I.instanceMatrix&&($=I.instanceMatrix),ie==="instanceColor"&&I.instanceColor&&($=I.instanceColor));const he={};he.attribute=$,$&&$.data&&(he.data=$.data),q[ie]=he,K++}h.attributes=q,h.attributesNum=K,h.index=j}function M(){const I=h.newAttributes;for(let N=0,W=I.length;N<W;N++)I[N]=0}function T(I){L(I,0)}function L(I,N){const W=h.newAttributes,j=h.enabledAttributes,q=h.attributeDivisors;W[I]=1,j[I]===0&&(i.enableVertexAttribArray(I),j[I]=1),q[I]!==N&&((n.isWebGL2?i:e.get("ANGLE_instanced_arrays"))[n.isWebGL2?"vertexAttribDivisor":"vertexAttribDivisorANGLE"](I,N),q[I]=N)}function R(){const I=h.newAttributes,N=h.enabledAttributes;for(let W=0,j=N.length;W<j;W++)N[W]!==I[W]&&(i.disableVertexAttribArray(W),N[W]=0)}function C(I,N,W,j,q,Y,K){K===!0?i.vertexAttribIPointer(I,N,W,q,Y):i.vertexAttribPointer(I,N,W,j,q,Y)}function V(I,N,W,j){if(n.isWebGL2===!1&&(I.isInstancedMesh||j.isInstancedBufferGeometry)&&e.get("ANGLE_instanced_arrays")===null)return;M();const q=j.attributes,Y=W.getAttributes(),K=N.defaultAttributeValues;for(const ne in Y){const ie=Y[ne];if(ie.location>=0){let X=q[ne];if(X===void 0&&(ne==="instanceMatrix"&&I.instanceMatrix&&(X=I.instanceMatrix),ne==="instanceColor"&&I.instanceColor&&(X=I.instanceColor)),X!==void 0){const $=X.normalized,he=X.itemSize,ve=t.get(X);if(ve===void 0)continue;const _e=ve.buffer,De=ve.type,Ue=ve.bytesPerElement,Te=n.isWebGL2===!0&&(De===i.INT||De===i.UNSIGNED_INT||X.gpuType===yc);if(X.isInterleavedBufferAttribute){const qe=X.data,O=qe.stride,bt=X.offset;if(qe.isInstancedInterleavedBuffer){for(let xe=0;xe<ie.locationSize;xe++)L(ie.location+xe,qe.meshPerAttribute);I.isInstancedMesh!==!0&&j._maxInstanceCount===void 0&&(j._maxInstanceCount=qe.meshPerAttribute*qe.count)}else for(let xe=0;xe<ie.locationSize;xe++)T(ie.location+xe);i.bindBuffer(i.ARRAY_BUFFER,_e);for(let xe=0;xe<ie.locationSize;xe++)C(ie.location+xe,he/ie.locationSize,De,$,O*Ue,(bt+he/ie.locationSize*xe)*Ue,Te)}else{if(X.isInstancedBufferAttribute){for(let qe=0;qe<ie.locationSize;qe++)L(ie.location+qe,X.meshPerAttribute);I.isInstancedMesh!==!0&&j._maxInstanceCount===void 0&&(j._maxInstanceCount=X.meshPerAttribute*X.count)}else for(let qe=0;qe<ie.locationSize;qe++)T(ie.location+qe);i.bindBuffer(i.ARRAY_BUFFER,_e);for(let qe=0;qe<ie.locationSize;qe++)C(ie.location+qe,he/ie.locationSize,De,$,he*Ue,he/ie.locationSize*qe*Ue,Te)}}else if(K!==void 0){const $=K[ne];if($!==void 0)switch($.length){case 2:i.vertexAttrib2fv(ie.location,$);break;case 3:i.vertexAttrib3fv(ie.location,$);break;case 4:i.vertexAttrib4fv(ie.location,$);break;default:i.vertexAttrib1fv(ie.location,$)}}}}R()}function S(){k();for(const I in o){const N=o[I];for(const W in N){const j=N[W];for(const q in j)v(j[q].object),delete j[q];delete N[W]}delete o[I]}}function b(I){if(o[I.id]===void 0)return;const N=o[I.id];for(const W in N){const j=N[W];for(const q in j)v(j[q].object),delete j[q];delete N[W]}delete o[I.id]}function z(I){for(const N in o){const W=o[N];if(W[I.id]===void 0)continue;const j=W[I.id];for(const q in j)v(j[q].object),delete j[q];delete W[I.id]}}function k(){Q(),u=!0,h!==c&&(h=c,g(h.object))}function Q(){c.geometry=null,c.program=null,c.wireframe=!1}return{setup:d,reset:k,resetDefaultState:Q,dispose:S,releaseStatesOfGeometry:b,releaseStatesOfProgram:z,initAttributes:M,enableAttribute:T,disableUnusedAttributes:R}}function Up(i,e,t,n){const r=n.isWebGL2;let s;function l(u){s=u}function o(u,d){i.drawArrays(s,u,d),t.update(d,s,1)}function c(u,d,p){if(p===0)return;let g,v;if(r)g=i,v="drawArraysInstanced";else if(g=e.get("ANGLE_instanced_arrays"),v="drawArraysInstancedANGLE",g===null){console.error("THREE.WebGLBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");return}g[v](s,u,d,p),t.update(d,s,p)}function h(u,d,p){if(p===0)return;const g=e.get("WEBGL_multi_draw");if(g===null)for(let v=0;v<p;v++)this.render(u[v],d[v]);else{g.multiDrawArraysWEBGL(s,u,0,d,0,p);let v=0;for(let _=0;_<p;_++)v+=d[_];t.update(v,s,1)}}this.setMode=l,this.render=o,this.renderInstances=c,this.renderMultiDraw=h}function Np(i,e,t){let n;function r(){if(n!==void 0)return n;if(e.has("EXT_texture_filter_anisotropic")===!0){const C=e.get("EXT_texture_filter_anisotropic");n=i.getParameter(C.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else n=0;return n}function s(C){if(C==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";C="mediump"}return C==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}const l=typeof WebGL2RenderingContext<"u"&&i.constructor.name==="WebGL2RenderingContext";let o=t.precision!==void 0?t.precision:"highp";const c=s(o);c!==o&&(console.warn("THREE.WebGLRenderer:",o,"not supported, using",c,"instead."),o=c);const h=l||e.has("WEBGL_draw_buffers"),u=t.logarithmicDepthBuffer===!0,d=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),p=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_TEXTURE_SIZE),v=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),_=i.getParameter(i.MAX_VERTEX_ATTRIBS),m=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),f=i.getParameter(i.MAX_VARYING_VECTORS),y=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),M=p>0,T=l||e.has("OES_texture_float"),L=M&&T,R=l?i.getParameter(i.MAX_SAMPLES):0;return{isWebGL2:l,drawBuffers:h,getMaxAnisotropy:r,getMaxPrecision:s,precision:o,logarithmicDepthBuffer:u,maxTextures:d,maxVertexTextures:p,maxTextureSize:g,maxCubemapSize:v,maxAttributes:_,maxVertexUniforms:m,maxVaryings:f,maxFragmentUniforms:y,vertexTextures:M,floatFragmentTextures:T,floatVertexTextures:L,maxSamples:R}}function Op(i){const e=this;let t=null,n=0,r=!1,s=!1;const l=new Kn,o=new He,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(d,p){const g=d.length!==0||p||n!==0||r;return r=p,n=d.length,g},this.beginShadows=function(){s=!0,u(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(d,p){t=u(d,p,0)},this.setState=function(d,p,g){const v=d.clippingPlanes,_=d.clipIntersection,m=d.clipShadows,f=i.get(d);if(!r||v===null||v.length===0||s&&!m)s?u(null):h();else{const y=s?0:n,M=y*4;let T=f.clippingState||null;c.value=T,T=u(v,p,M,g);for(let L=0;L!==M;++L)T[L]=t[L];f.clippingState=T,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=y}};function h(){c.value!==t&&(c.value=t,c.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function u(d,p,g,v){const _=d!==null?d.length:0;let m=null;if(_!==0){if(m=c.value,v!==!0||m===null){const f=g+_*4,y=p.matrixWorldInverse;o.getNormalMatrix(y),(m===null||m.length<f)&&(m=new Float32Array(f));for(let M=0,T=g;M!==_;++M,T+=4)l.copy(d[M]).applyMatrix4(y,o),l.normal.toArray(m,T),m[T+3]=l.constant}c.value=m,c.needsUpdate=!0}return e.numPlanes=_,e.numIntersection=0,m}}function Fp(i){let e=new WeakMap;function t(l,o){return o===Eo?l.mapping=Gi:o===To&&(l.mapping=zi),l}function n(l){if(l&&l.isTexture){const o=l.mapping;if(o===Eo||o===To)if(e.has(l)){const c=e.get(l).texture;return t(c,l.mapping)}else{const c=l.image;if(c&&c.height>0){const h=new ju(c.height/2);return h.fromEquirectangularTexture(i,l),e.set(l,h),l.addEventListener("dispose",r),t(h.texture,l.mapping)}else return null}}return l}function r(l){const o=l.target;o.removeEventListener("dispose",r);const c=e.get(o);c!==void 0&&(e.delete(o),c.dispose())}function s(){e=new WeakMap}return{get:n,dispose:s}}class Hc extends Gc{constructor(e=-1,t=1,n=1,r=-1,s=.1,l=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=r,this.near=s,this.far=l,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,r,s,l){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=s,this.view.height=l,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,r=(this.top+this.bottom)/2;let s=n-e,l=n+e,o=r+t,c=r-t;if(this.view!==null&&this.view.enabled){const h=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=h*this.view.offsetX,l=s+h*this.view.width,o-=u*this.view.offsetY,c=o-u*this.view.height}this.projectionMatrix.makeOrthographic(s,l,o,c,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}const Ni=4,el=[.125,.215,.35,.446,.526,.582],Zn=20,Zs=new Hc,tl=new We;let Qs=null,eo=0,to=0;const $n=(1+Math.sqrt(5))/2,bi=1/$n,nl=[new P(1,1,1),new P(-1,1,1),new P(1,1,-1),new P(-1,1,-1),new P(0,$n,bi),new P(0,$n,-bi),new P(bi,0,$n),new P(-bi,0,$n),new P($n,bi,0),new P(-$n,bi,0)];class il{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,n=.1,r=100){Qs=this._renderer.getRenderTarget(),eo=this._renderer.getActiveCubeFace(),to=this._renderer.getActiveMipmapLevel(),this._setSize(256);const s=this._allocateTargets();return s.depthBuffer=!0,this._sceneToCubeUV(e,n,r,s),t>0&&this._blur(s,0,0,t),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=ol(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=sl(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(Qs,eo,to),e.scissorTest=!1,Fr(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Gi||e.mapping===zi?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Qs=this._renderer.getRenderTarget(),eo=this._renderer.getActiveCubeFace(),to=this._renderer.getActiveMipmapLevel();const n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:Wt,minFilter:Wt,generateMipmaps:!1,type:or,format:sn,colorSpace:xn,depthBuffer:!1},r=rl(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=rl(e,t,n);const{_lodMax:s}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=Bp(s)),this._blurMaterial=Gp(s,e,t)}return r}_compileMaterial(e){const t=new ce(this._lodPlanes[0],e);this._renderer.compile(t,Zs)}_sceneToCubeUV(e,t,n,r){const o=new qt(90,1,t,n),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],u=this._renderer,d=u.autoClear,p=u.toneMapping;u.getClearColor(tl),u.toneMapping=Un,u.autoClear=!1;const g=new vt({name:"PMREM.Background",side:Ut,depthWrite:!1,depthTest:!1}),v=new ce(new Xe,g);let _=!1;const m=e.background;m?m.isColor&&(g.color.copy(m),e.background=null,_=!0):(g.color.copy(tl),_=!0);for(let f=0;f<6;f++){const y=f%3;y===0?(o.up.set(0,c[f],0),o.lookAt(h[f],0,0)):y===1?(o.up.set(0,0,c[f]),o.lookAt(0,h[f],0)):(o.up.set(0,c[f],0),o.lookAt(0,0,h[f]));const M=this._cubeSize;Fr(r,y*M,f>2?M:0,M,M),u.setRenderTarget(r),_&&u.render(v,o),u.render(e,o)}v.geometry.dispose(),v.material.dispose(),u.toneMapping=p,u.autoClear=d,e.background=m}_textureToCubeUV(e,t){const n=this._renderer,r=e.mapping===Gi||e.mapping===zi;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=ol()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=sl());const s=r?this._cubemapMaterial:this._equirectMaterial,l=new ce(this._lodPlanes[0],s),o=s.uniforms;o.envMap.value=e;const c=this._cubeSize;Fr(t,0,0,3*c,2*c),n.setRenderTarget(t),n.render(l,Zs)}_applyPMREM(e){const t=this._renderer,n=t.autoClear;t.autoClear=!1;for(let r=1;r<this._lodPlanes.length;r++){const s=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),l=nl[(r-1)%nl.length];this._blur(e,r-1,r,s,l)}t.autoClear=n}_blur(e,t,n,r,s){const l=this._pingPongRenderTarget;this._halfBlur(e,l,t,n,r,"latitudinal",s),this._halfBlur(l,e,n,n,r,"longitudinal",s)}_halfBlur(e,t,n,r,s,l,o){const c=this._renderer,h=this._blurMaterial;l!=="latitudinal"&&l!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const u=3,d=new ce(this._lodPlanes[r],h),p=h.uniforms,g=this._sizeLods[n]-1,v=isFinite(s)?Math.PI/(2*g):2*Math.PI/(2*Zn-1),_=s/v,m=isFinite(s)?1+Math.floor(u*_):Zn;m>Zn&&console.warn(`sigmaRadians, ${s}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${Zn}`);const f=[];let y=0;for(let C=0;C<Zn;++C){const V=C/_,S=Math.exp(-V*V/2);f.push(S),C===0?y+=S:C<m&&(y+=2*S)}for(let C=0;C<f.length;C++)f[C]=f[C]/y;p.envMap.value=e.texture,p.samples.value=m,p.weights.value=f,p.latitudinal.value=l==="latitudinal",o&&(p.poleAxis.value=o);const{_lodMax:M}=this;p.dTheta.value=v,p.mipInt.value=M-n;const T=this._sizeLods[r],L=3*T*(r>M-Ni?r-M+Ni:0),R=4*(this._cubeSize-T);Fr(t,L,R,3*T,2*T),c.setRenderTarget(t),c.render(d,Zs)}}function Bp(i){const e=[],t=[],n=[];let r=i;const s=i-Ni+1+el.length;for(let l=0;l<s;l++){const o=Math.pow(2,r);t.push(o);let c=1/o;l>i-Ni?c=el[l-i+Ni-1]:l===0&&(c=0),n.push(c);const h=1/(o-2),u=-h,d=1+h,p=[u,u,d,u,d,d,u,u,d,d,u,d],g=6,v=6,_=3,m=2,f=1,y=new Float32Array(_*v*g),M=new Float32Array(m*v*g),T=new Float32Array(f*v*g);for(let R=0;R<g;R++){const C=R%3*2/3-1,V=R>2?0:-1,S=[C,V,0,C+2/3,V,0,C+2/3,V+1,0,C,V,0,C+2/3,V+1,0,C,V+1,0];y.set(S,_*v*R),M.set(p,m*v*R);const b=[R,R,R,R,R,R];T.set(b,f*v*R)}const L=new Zt;L.setAttribute("position",new $t(y,_)),L.setAttribute("uv",new $t(M,m)),L.setAttribute("faceIndex",new $t(T,f)),e.push(L),r>Ni&&r--}return{lodPlanes:e,sizeLods:t,sigmas:n}}function rl(i,e,t){const n=new ii(i,e,t);return n.texture.mapping=ms,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Fr(i,e,t,n,r){i.viewport.set(e,t,n,r),i.scissor.set(e,t,n,r)}function Gp(i,e,t){const n=new Float32Array(Zn),r=new P(0,1,0);return new ri({name:"SphericalGaussianBlur",defines:{n:Zn,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:r}},vertexShader:Ho(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:In,depthTest:!1,depthWrite:!1})}function sl(){return new ri({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Ho(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:In,depthTest:!1,depthWrite:!1})}function ol(){return new ri({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Ho(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:In,depthTest:!1,depthWrite:!1})}function Ho(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function zp(i){let e=new WeakMap,t=null;function n(o){if(o&&o.isTexture){const c=o.mapping,h=c===Eo||c===To,u=c===Gi||c===zi;if(h||u)if(o.isRenderTargetTexture&&o.needsPMREMUpdate===!0){o.needsPMREMUpdate=!1;let d=e.get(o);return t===null&&(t=new il(i)),d=h?t.fromEquirectangular(o,d):t.fromCubemap(o,d),e.set(o,d),d.texture}else{if(e.has(o))return e.get(o).texture;{const d=o.image;if(h&&d&&d.height>0||u&&d&&r(d)){t===null&&(t=new il(i));const p=h?t.fromEquirectangular(o):t.fromCubemap(o);return e.set(o,p),o.addEventListener("dispose",s),p.texture}else return null}}}return o}function r(o){let c=0;const h=6;for(let u=0;u<h;u++)o[u]!==void 0&&c++;return c===h}function s(o){const c=o.target;c.removeEventListener("dispose",s);const h=e.get(c);h!==void 0&&(e.delete(c),h.dispose())}function l(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:n,dispose:l}}function kp(i){const e={};function t(n){if(e[n]!==void 0)return e[n];let r;switch(n){case"WEBGL_depth_texture":r=i.getExtension("WEBGL_depth_texture")||i.getExtension("MOZ_WEBGL_depth_texture")||i.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":r=i.getExtension("EXT_texture_filter_anisotropic")||i.getExtension("MOZ_EXT_texture_filter_anisotropic")||i.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":r=i.getExtension("WEBGL_compressed_texture_s3tc")||i.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":r=i.getExtension("WEBGL_compressed_texture_pvrtc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:r=i.getExtension(n)}return e[n]=r,r}return{has:function(n){return t(n)!==null},init:function(n){n.isWebGL2?(t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance")):(t("WEBGL_depth_texture"),t("OES_texture_float"),t("OES_texture_half_float"),t("OES_texture_half_float_linear"),t("OES_standard_derivatives"),t("OES_element_index_uint"),t("OES_vertex_array_object"),t("ANGLE_instanced_arrays")),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture")},get:function(n){const r=t(n);return r===null&&console.warn("THREE.WebGLRenderer: "+n+" extension not supported."),r}}}function Hp(i,e,t,n){const r={},s=new WeakMap;function l(d){const p=d.target;p.index!==null&&e.remove(p.index);for(const v in p.attributes)e.remove(p.attributes[v]);for(const v in p.morphAttributes){const _=p.morphAttributes[v];for(let m=0,f=_.length;m<f;m++)e.remove(_[m])}p.removeEventListener("dispose",l),delete r[p.id];const g=s.get(p);g&&(e.remove(g),s.delete(p)),n.releaseStatesOfGeometry(p),p.isInstancedBufferGeometry===!0&&delete p._maxInstanceCount,t.memory.geometries--}function o(d,p){return r[p.id]===!0||(p.addEventListener("dispose",l),r[p.id]=!0,t.memory.geometries++),p}function c(d){const p=d.attributes;for(const v in p)e.update(p[v],i.ARRAY_BUFFER);const g=d.morphAttributes;for(const v in g){const _=g[v];for(let m=0,f=_.length;m<f;m++)e.update(_[m],i.ARRAY_BUFFER)}}function h(d){const p=[],g=d.index,v=d.attributes.position;let _=0;if(g!==null){const y=g.array;_=g.version;for(let M=0,T=y.length;M<T;M+=3){const L=y[M+0],R=y[M+1],C=y[M+2];p.push(L,R,R,C,C,L)}}else if(v!==void 0){const y=v.array;_=v.version;for(let M=0,T=y.length/3-1;M<T;M+=3){const L=M+0,R=M+1,C=M+2;p.push(L,R,R,C,C,L)}}else return;const m=new(Pc(p)?Fc:Oc)(p,1);m.version=_;const f=s.get(d);f&&e.remove(f),s.set(d,m)}function u(d){const p=s.get(d);if(p){const g=d.index;g!==null&&p.version<g.version&&h(d)}else h(d);return s.get(d)}return{get:o,update:c,getWireframeAttribute:u}}function Vp(i,e,t,n){const r=n.isWebGL2;let s;function l(g){s=g}let o,c;function h(g){o=g.type,c=g.bytesPerElement}function u(g,v){i.drawElements(s,v,o,g*c),t.update(v,s,1)}function d(g,v,_){if(_===0)return;let m,f;if(r)m=i,f="drawElementsInstanced";else if(m=e.get("ANGLE_instanced_arrays"),f="drawElementsInstancedANGLE",m===null){console.error("THREE.WebGLIndexedBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");return}m[f](s,v,o,g*c,_),t.update(v,s,_)}function p(g,v,_){if(_===0)return;const m=e.get("WEBGL_multi_draw");if(m===null)for(let f=0;f<_;f++)this.render(g[f]/c,v[f]);else{m.multiDrawElementsWEBGL(s,v,0,o,g,0,_);let f=0;for(let y=0;y<_;y++)f+=v[y];t.update(f,s,1)}}this.setMode=l,this.setIndex=h,this.render=u,this.renderInstances=d,this.renderMultiDraw=p}function Wp(i){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(s,l,o){switch(t.calls++,l){case i.TRIANGLES:t.triangles+=o*(s/3);break;case i.LINES:t.lines+=o*(s/2);break;case i.LINE_STRIP:t.lines+=o*(s-1);break;case i.LINE_LOOP:t.lines+=o*s;break;case i.POINTS:t.points+=o*s;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",l);break}}function r(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:r,update:n}}function Xp(i,e){return i[0]-e[0]}function qp(i,e){return Math.abs(e[1])-Math.abs(i[1])}function Yp(i,e,t){const n={},r=new Float32Array(8),s=new WeakMap,l=new mt,o=[];for(let h=0;h<8;h++)o[h]=[h,0];function c(h,u,d){const p=h.morphTargetInfluences;if(e.isWebGL2===!0){const v=u.morphAttributes.position||u.morphAttributes.normal||u.morphAttributes.color,_=v!==void 0?v.length:0;let m=s.get(u);if(m===void 0||m.count!==_){let N=function(){Q.dispose(),s.delete(u),u.removeEventListener("dispose",N)};var g=N;m!==void 0&&m.texture.dispose();const M=u.morphAttributes.position!==void 0,T=u.morphAttributes.normal!==void 0,L=u.morphAttributes.color!==void 0,R=u.morphAttributes.position||[],C=u.morphAttributes.normal||[],V=u.morphAttributes.color||[];let S=0;M===!0&&(S=1),T===!0&&(S=2),L===!0&&(S=3);let b=u.attributes.position.count*S,z=1;b>e.maxTextureSize&&(z=Math.ceil(b/e.maxTextureSize),b=e.maxTextureSize);const k=new Float32Array(b*z*4*_),Q=new Ic(k,b,z,_);Q.type=Pn,Q.needsUpdate=!0;const I=S*4;for(let W=0;W<_;W++){const j=R[W],q=C[W],Y=V[W],K=b*z*4*W;for(let ne=0;ne<j.count;ne++){const ie=ne*I;M===!0&&(l.fromBufferAttribute(j,ne),k[K+ie+0]=l.x,k[K+ie+1]=l.y,k[K+ie+2]=l.z,k[K+ie+3]=0),T===!0&&(l.fromBufferAttribute(q,ne),k[K+ie+4]=l.x,k[K+ie+5]=l.y,k[K+ie+6]=l.z,k[K+ie+7]=0),L===!0&&(l.fromBufferAttribute(Y,ne),k[K+ie+8]=l.x,k[K+ie+9]=l.y,k[K+ie+10]=l.z,k[K+ie+11]=Y.itemSize===4?l.w:1)}}m={count:_,texture:Q,size:new Re(b,z)},s.set(u,m),u.addEventListener("dispose",N)}let f=0;for(let M=0;M<p.length;M++)f+=p[M];const y=u.morphTargetsRelative?1:1-f;d.getUniforms().setValue(i,"morphTargetBaseInfluence",y),d.getUniforms().setValue(i,"morphTargetInfluences",p),d.getUniforms().setValue(i,"morphTargetsTexture",m.texture,t),d.getUniforms().setValue(i,"morphTargetsTextureSize",m.size)}else{const v=p===void 0?0:p.length;let _=n[u.id];if(_===void 0||_.length!==v){_=[];for(let T=0;T<v;T++)_[T]=[T,0];n[u.id]=_}for(let T=0;T<v;T++){const L=_[T];L[0]=T,L[1]=p[T]}_.sort(qp);for(let T=0;T<8;T++)T<v&&_[T][1]?(o[T][0]=_[T][0],o[T][1]=_[T][1]):(o[T][0]=Number.MAX_SAFE_INTEGER,o[T][1]=0);o.sort(Xp);const m=u.morphAttributes.position,f=u.morphAttributes.normal;let y=0;for(let T=0;T<8;T++){const L=o[T],R=L[0],C=L[1];R!==Number.MAX_SAFE_INTEGER&&C?(m&&u.getAttribute("morphTarget"+T)!==m[R]&&u.setAttribute("morphTarget"+T,m[R]),f&&u.getAttribute("morphNormal"+T)!==f[R]&&u.setAttribute("morphNormal"+T,f[R]),r[T]=C,y+=C):(m&&u.hasAttribute("morphTarget"+T)===!0&&u.deleteAttribute("morphTarget"+T),f&&u.hasAttribute("morphNormal"+T)===!0&&u.deleteAttribute("morphNormal"+T),r[T]=0)}const M=u.morphTargetsRelative?1:1-y;d.getUniforms().setValue(i,"morphTargetBaseInfluence",M),d.getUniforms().setValue(i,"morphTargetInfluences",r)}}return{update:c}}function jp(i,e,t,n){let r=new WeakMap;function s(c){const h=n.render.frame,u=c.geometry,d=e.get(c,u);if(r.get(d)!==h&&(e.update(d),r.set(d,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",o)===!1&&c.addEventListener("dispose",o),r.get(c)!==h&&(t.update(c.instanceMatrix,i.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,i.ARRAY_BUFFER),r.set(c,h))),c.isSkinnedMesh){const p=c.skeleton;r.get(p)!==h&&(p.update(),r.set(p,h))}return d}function l(){r=new WeakMap}function o(c){const h=c.target;h.removeEventListener("dispose",o),t.remove(h.instanceMatrix),h.instanceColor!==null&&t.remove(h.instanceColor)}return{update:s,dispose:l}}class Vc extends Nt{constructor(e,t,n,r,s,l,o,c,h,u){if(u=u!==void 0?u:ei,u!==ei&&u!==ki)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&u===ei&&(n=Cn),n===void 0&&u===ki&&(n=Qn),super(null,r,s,l,o,c,u,n,h),this.isDepthTexture=!0,this.image={width:e,height:t},this.magFilter=o!==void 0?o:Pt,this.minFilter=c!==void 0?c:Pt,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}const Wc=new Nt,Xc=new Vc(1,1);Xc.compareFunction=Cc;const qc=new Ic,Yc=new Lu,jc=new zc,al=[],ll=[],cl=new Float32Array(16),hl=new Float32Array(9),ul=new Float32Array(4);function Vi(i,e,t){const n=i[0];if(n<=0||n>0)return i;const r=e*t;let s=al[r];if(s===void 0&&(s=new Float32Array(r),al[r]=s),e!==0){n.toArray(s,0);for(let l=1,o=0;l!==e;++l)o+=t,i[l].toArray(s,o)}return s}function ht(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function ut(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function _s(i,e){let t=ll[e];t===void 0&&(t=new Int32Array(e),ll[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function Kp(i,e){const t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function $p(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(ht(t,e))return;i.uniform2fv(this.addr,e),ut(t,e)}}function Jp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(ht(t,e))return;i.uniform3fv(this.addr,e),ut(t,e)}}function Zp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(ht(t,e))return;i.uniform4fv(this.addr,e),ut(t,e)}}function Qp(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(ht(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),ut(t,e)}else{if(ht(t,n))return;ul.set(n),i.uniformMatrix2fv(this.addr,!1,ul),ut(t,n)}}function em(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(ht(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),ut(t,e)}else{if(ht(t,n))return;hl.set(n),i.uniformMatrix3fv(this.addr,!1,hl),ut(t,n)}}function tm(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(ht(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),ut(t,e)}else{if(ht(t,n))return;cl.set(n),i.uniformMatrix4fv(this.addr,!1,cl),ut(t,n)}}function nm(i,e){const t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function im(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(ht(t,e))return;i.uniform2iv(this.addr,e),ut(t,e)}}function rm(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(ht(t,e))return;i.uniform3iv(this.addr,e),ut(t,e)}}function sm(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(ht(t,e))return;i.uniform4iv(this.addr,e),ut(t,e)}}function om(i,e){const t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function am(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(ht(t,e))return;i.uniform2uiv(this.addr,e),ut(t,e)}}function lm(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(ht(t,e))return;i.uniform3uiv(this.addr,e),ut(t,e)}}function cm(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(ht(t,e))return;i.uniform4uiv(this.addr,e),ut(t,e)}}function hm(i,e,t){const n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r);const s=this.type===i.SAMPLER_2D_SHADOW?Xc:Wc;t.setTexture2D(e||s,r)}function um(i,e,t){const n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r),t.setTexture3D(e||Yc,r)}function dm(i,e,t){const n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r),t.setTextureCube(e||jc,r)}function fm(i,e,t){const n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r),t.setTexture2DArray(e||qc,r)}function pm(i){switch(i){case 5126:return Kp;case 35664:return $p;case 35665:return Jp;case 35666:return Zp;case 35674:return Qp;case 35675:return em;case 35676:return tm;case 5124:case 35670:return nm;case 35667:case 35671:return im;case 35668:case 35672:return rm;case 35669:case 35673:return sm;case 5125:return om;case 36294:return am;case 36295:return lm;case 36296:return cm;case 35678:case 36198:case 36298:case 36306:case 35682:return hm;case 35679:case 36299:case 36307:return um;case 35680:case 36300:case 36308:case 36293:return dm;case 36289:case 36303:case 36311:case 36292:return fm}}function mm(i,e){i.uniform1fv(this.addr,e)}function gm(i,e){const t=Vi(e,this.size,2);i.uniform2fv(this.addr,t)}function _m(i,e){const t=Vi(e,this.size,3);i.uniform3fv(this.addr,t)}function vm(i,e){const t=Vi(e,this.size,4);i.uniform4fv(this.addr,t)}function Mm(i,e){const t=Vi(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function xm(i,e){const t=Vi(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function ym(i,e){const t=Vi(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function Sm(i,e){i.uniform1iv(this.addr,e)}function Em(i,e){i.uniform2iv(this.addr,e)}function Tm(i,e){i.uniform3iv(this.addr,e)}function bm(i,e){i.uniform4iv(this.addr,e)}function Am(i,e){i.uniform1uiv(this.addr,e)}function wm(i,e){i.uniform2uiv(this.addr,e)}function Rm(i,e){i.uniform3uiv(this.addr,e)}function Cm(i,e){i.uniform4uiv(this.addr,e)}function Pm(i,e,t){const n=this.cache,r=e.length,s=_s(t,r);ht(n,s)||(i.uniform1iv(this.addr,s),ut(n,s));for(let l=0;l!==r;++l)t.setTexture2D(e[l]||Wc,s[l])}function Lm(i,e,t){const n=this.cache,r=e.length,s=_s(t,r);ht(n,s)||(i.uniform1iv(this.addr,s),ut(n,s));for(let l=0;l!==r;++l)t.setTexture3D(e[l]||Yc,s[l])}function Dm(i,e,t){const n=this.cache,r=e.length,s=_s(t,r);ht(n,s)||(i.uniform1iv(this.addr,s),ut(n,s));for(let l=0;l!==r;++l)t.setTextureCube(e[l]||jc,s[l])}function Im(i,e,t){const n=this.cache,r=e.length,s=_s(t,r);ht(n,s)||(i.uniform1iv(this.addr,s),ut(n,s));for(let l=0;l!==r;++l)t.setTexture2DArray(e[l]||qc,s[l])}function Um(i){switch(i){case 5126:return mm;case 35664:return gm;case 35665:return _m;case 35666:return vm;case 35674:return Mm;case 35675:return xm;case 35676:return ym;case 5124:case 35670:return Sm;case 35667:case 35671:return Em;case 35668:case 35672:return Tm;case 35669:case 35673:return bm;case 5125:return Am;case 36294:return wm;case 36295:return Rm;case 36296:return Cm;case 35678:case 36198:case 36298:case 36306:case 35682:return Pm;case 35679:case 36299:case 36307:return Lm;case 35680:case 36300:case 36308:case 36293:return Dm;case 36289:case 36303:case 36311:case 36292:return Im}}class Nm{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=pm(t.type)}}class Om{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Um(t.type)}}class Fm{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){const r=this.seq;for(let s=0,l=r.length;s!==l;++s){const o=r[s];o.setValue(e,t[o.id],n)}}}const no=/(\w+)(\])?(\[|\.)?/g;function dl(i,e){i.seq.push(e),i.map[e.id]=e}function Bm(i,e,t){const n=i.name,r=n.length;for(no.lastIndex=0;;){const s=no.exec(n),l=no.lastIndex;let o=s[1];const c=s[2]==="]",h=s[3];if(c&&(o=o|0),h===void 0||h==="["&&l+2===r){dl(t,h===void 0?new Nm(o,i,e):new Om(o,i,e));break}else{let d=t.map[o];d===void 0&&(d=new Fm(o),dl(t,d)),t=d}}}class Qr{constructor(e,t){this.seq=[],this.map={};const n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<n;++r){const s=e.getActiveUniform(t,r),l=e.getUniformLocation(t,s.name);Bm(s,l,this)}}setValue(e,t,n,r){const s=this.map[t];s!==void 0&&s.setValue(e,n,r)}setOptional(e,t,n){const r=t[n];r!==void 0&&this.setValue(e,n,r)}static upload(e,t,n,r){for(let s=0,l=t.length;s!==l;++s){const o=t[s],c=n[o.id];c.needsUpdate!==!1&&o.setValue(e,c.value,r)}}static seqWithValue(e,t){const n=[];for(let r=0,s=e.length;r!==s;++r){const l=e[r];l.id in t&&n.push(l)}return n}}function fl(i,e,t){const n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}const Gm=37297;let zm=0;function km(i,e){const t=i.split(`
`),n=[],r=Math.max(e-6,0),s=Math.min(e+6,t.length);for(let l=r;l<s;l++){const o=l+1;n.push(`${o===e?">":" "} ${o}: ${t[l]}`)}return n.join(`
`)}function Hm(i){const e=Ke.getPrimaries(Ke.workingColorSpace),t=Ke.getPrimaries(i);let n;switch(e===t?n="":e===is&&t===ns?n="LinearDisplayP3ToLinearSRGB":e===ns&&t===is&&(n="LinearSRGBToLinearDisplayP3"),i){case xn:case gs:return[n,"LinearTransferOETF"];case Mt:case Go:return[n,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space:",i),[n,"LinearTransferOETF"]}}function pl(i,e,t){const n=i.getShaderParameter(e,i.COMPILE_STATUS),r=i.getShaderInfoLog(e).trim();if(n&&r==="")return"";const s=/ERROR: 0:(\d+)/.exec(r);if(s){const l=parseInt(s[1]);return t.toUpperCase()+`

`+r+`

`+km(i.getShaderSource(e),l)}else return r}function Vm(i,e){const t=Hm(e);return`vec4 ${i}( vec4 value ) { return ${t[0]}( ${t[1]}( value ) ); }`}function Wm(i,e){let t;switch(e){case eu:t="Linear";break;case tu:t="Reinhard";break;case nu:t="OptimizedCineon";break;case iu:t="ACESFilmic";break;case su:t="AgX";break;case ru:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}function Xm(i){return[i.extensionDerivatives||i.envMapCubeUVHeight||i.bumpMap||i.normalMapTangentSpace||i.clearcoatNormalMap||i.flatShading||i.shaderID==="physical"?"#extension GL_OES_standard_derivatives : enable":"",(i.extensionFragDepth||i.logarithmicDepthBuffer)&&i.rendererExtensionFragDepth?"#extension GL_EXT_frag_depth : enable":"",i.extensionDrawBuffers&&i.rendererExtensionDrawBuffers?"#extension GL_EXT_draw_buffers : require":"",(i.extensionShaderTextureLOD||i.envMap||i.transmission)&&i.rendererExtensionShaderTextureLod?"#extension GL_EXT_shader_texture_lod : enable":""].filter(Oi).join(`
`)}function qm(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":""].filter(Oi).join(`
`)}function Ym(i){const e=[];for(const t in i){const n=i[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function jm(i,e){const t={},n=i.getProgramParameter(e,i.ACTIVE_ATTRIBUTES);for(let r=0;r<n;r++){const s=i.getActiveAttrib(e,r),l=s.name;let o=1;s.type===i.FLOAT_MAT2&&(o=2),s.type===i.FLOAT_MAT3&&(o=3),s.type===i.FLOAT_MAT4&&(o=4),t[l]={type:s.type,location:i.getAttribLocation(e,l),locationSize:o}}return t}function Oi(i){return i!==""}function ml(i,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function gl(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const Km=/^[ \t]*#include +<([\w\d./]+)>/gm;function Po(i){return i.replace(Km,Jm)}const $m=new Map([["encodings_fragment","colorspace_fragment"],["encodings_pars_fragment","colorspace_pars_fragment"],["output_fragment","opaque_fragment"]]);function Jm(i,e){let t=Oe[e];if(t===void 0){const n=$m.get(e);if(n!==void 0)t=Oe[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("Can not resolve #include <"+e+">")}return Po(t)}const Zm=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function _l(i){return i.replace(Zm,Qm)}function Qm(i,e,t,n){let r="";for(let s=parseInt(e);s<parseInt(t);s++)r+=n.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function vl(i){let e="precision "+i.precision+` float;
precision `+i.precision+" int;";return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function eg(i){let e="SHADOWMAP_TYPE_BASIC";return i.shadowMapType===vc?e="SHADOWMAP_TYPE_PCF":i.shadowMapType===Mc?e="SHADOWMAP_TYPE_PCF_SOFT":i.shadowMapType===gn&&(e="SHADOWMAP_TYPE_VSM"),e}function tg(i){let e="ENVMAP_TYPE_CUBE";if(i.envMap)switch(i.envMapMode){case Gi:case zi:e="ENVMAP_TYPE_CUBE";break;case ms:e="ENVMAP_TYPE_CUBE_UV";break}return e}function ng(i){let e="ENVMAP_MODE_REFLECTION";if(i.envMap)switch(i.envMapMode){case zi:e="ENVMAP_MODE_REFRACTION";break}return e}function ig(i){let e="ENVMAP_BLENDING_NONE";if(i.envMap)switch(i.combine){case Oo:e="ENVMAP_BLENDING_MULTIPLY";break;case Zh:e="ENVMAP_BLENDING_MIX";break;case Qh:e="ENVMAP_BLENDING_ADD";break}return e}function rg(i){const e=i.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),7*16)),texelHeight:n,maxMip:t}}function sg(i,e,t,n){const r=i.getContext(),s=t.defines;let l=t.vertexShader,o=t.fragmentShader;const c=eg(t),h=tg(t),u=ng(t),d=ig(t),p=rg(t),g=t.isWebGL2?"":Xm(t),v=qm(t),_=Ym(s),m=r.createProgram();let f,y,M=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(f=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_].filter(Oi).join(`
`),f.length>0&&(f+=`
`),y=[g,"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_].filter(Oi).join(`
`),y.length>0&&(y+=`
`)):(f=[vl(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+u:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors&&t.isWebGL2?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0&&t.isWebGL2?"#define MORPHTARGETS_TEXTURE":"",t.morphTargetsCount>0&&t.isWebGL2?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0&&t.isWebGL2?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.useLegacyLights?"#define LEGACY_LIGHTS":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.logarithmicDepthBuffer&&t.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#if ( defined( USE_MORPHTARGETS ) && ! defined( MORPHTARGETS_TEXTURE ) )","	attribute vec3 morphTarget0;","	attribute vec3 morphTarget1;","	attribute vec3 morphTarget2;","	attribute vec3 morphTarget3;","	#ifdef USE_MORPHNORMALS","		attribute vec3 morphNormal0;","		attribute vec3 morphNormal1;","		attribute vec3 morphNormal2;","		attribute vec3 morphNormal3;","	#else","		attribute vec3 morphTarget4;","		attribute vec3 morphTarget5;","		attribute vec3 morphTarget6;","		attribute vec3 morphTarget7;","	#endif","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Oi).join(`
`),y=[g,vl(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.envMap?"#define "+u:"",t.envMap?"#define "+d:"",p?"#define CUBEUV_TEXEL_WIDTH "+p.texelWidth:"",p?"#define CUBEUV_TEXEL_HEIGHT "+p.texelHeight:"",p?"#define CUBEUV_MAX_MIP "+p.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.useLegacyLights?"#define LEGACY_LIGHTS":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.logarithmicDepthBuffer&&t.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Un?"#define TONE_MAPPING":"",t.toneMapping!==Un?Oe.tonemapping_pars_fragment:"",t.toneMapping!==Un?Wm("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Oe.colorspace_pars_fragment,Vm("linearToOutputTexel",t.outputColorSpace),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(Oi).join(`
`)),l=Po(l),l=ml(l,t),l=gl(l,t),o=Po(o),o=ml(o,t),o=gl(o,t),l=_l(l),o=_l(o),t.isWebGL2&&t.isRawShaderMaterial!==!0&&(M=`#version 300 es
`,f=[v,"precision mediump sampler2DArray;","#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+f,y=["precision mediump sampler2DArray;","#define varying in",t.glslVersion===Oa?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Oa?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+y);const T=M+f+l,L=M+y+o,R=fl(r,r.VERTEX_SHADER,T),C=fl(r,r.FRAGMENT_SHADER,L);r.attachShader(m,R),r.attachShader(m,C),t.index0AttributeName!==void 0?r.bindAttribLocation(m,0,t.index0AttributeName):t.morphTargets===!0&&r.bindAttribLocation(m,0,"position"),r.linkProgram(m);function V(k){if(i.debug.checkShaderErrors){const Q=r.getProgramInfoLog(m).trim(),I=r.getShaderInfoLog(R).trim(),N=r.getShaderInfoLog(C).trim();let W=!0,j=!0;if(r.getProgramParameter(m,r.LINK_STATUS)===!1)if(W=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(r,m,R,C);else{const q=pl(r,R,"vertex"),Y=pl(r,C,"fragment");console.error("THREE.WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(m,r.VALIDATE_STATUS)+`

Program Info Log: `+Q+`
`+q+`
`+Y)}else Q!==""?console.warn("THREE.WebGLProgram: Program Info Log:",Q):(I===""||N==="")&&(j=!1);j&&(k.diagnostics={runnable:W,programLog:Q,vertexShader:{log:I,prefix:f},fragmentShader:{log:N,prefix:y}})}r.deleteShader(R),r.deleteShader(C),S=new Qr(r,m),b=jm(r,m)}let S;this.getUniforms=function(){return S===void 0&&V(this),S};let b;this.getAttributes=function(){return b===void 0&&V(this),b};let z=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return z===!1&&(z=r.getProgramParameter(m,Gm)),z},this.destroy=function(){n.releaseStatesOfProgram(this),r.deleteProgram(m),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=zm++,this.cacheKey=e,this.usedTimes=1,this.program=m,this.vertexShader=R,this.fragmentShader=C,this}let og=0;class ag{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){const t=e.vertexShader,n=e.fragmentShader,r=this._getShaderStage(t),s=this._getShaderStage(n),l=this._getShaderCacheForMaterial(e);return l.has(r)===!1&&(l.add(r),r.usedTimes++),l.has(s)===!1&&(l.add(s),s.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){const t=this.shaderCache;let n=t.get(e);return n===void 0&&(n=new lg(e),t.set(e,n)),n}}class lg{constructor(e){this.id=og++,this.code=e,this.usedTimes=0}}function cg(i,e,t,n,r,s,l){const o=new zo,c=new ag,h=[],u=r.isWebGL2,d=r.logarithmicDepthBuffer,p=r.vertexTextures;let g=r.precision;const v={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(S){return S===0?"uv":`uv${S}`}function m(S,b,z,k,Q){const I=k.fog,N=Q.geometry,W=S.isMeshStandardMaterial?k.environment:null,j=(S.isMeshStandardMaterial?t:e).get(S.envMap||W),q=j&&j.mapping===ms?j.image.height:null,Y=v[S.type];S.precision!==null&&(g=r.getMaxPrecision(S.precision),g!==S.precision&&console.warn("THREE.WebGLProgram.getParameters:",S.precision,"not supported, using",g,"instead."));const K=N.morphAttributes.position||N.morphAttributes.normal||N.morphAttributes.color,ne=K!==void 0?K.length:0;let ie=0;N.morphAttributes.position!==void 0&&(ie=1),N.morphAttributes.normal!==void 0&&(ie=2),N.morphAttributes.color!==void 0&&(ie=3);let X,$,he,ve;if(Y){const At=cn[Y];X=At.vertexShader,$=At.fragmentShader}else X=S.vertexShader,$=S.fragmentShader,c.update(S),he=c.getVertexShaderID(S),ve=c.getFragmentShaderID(S);const _e=i.getRenderTarget(),De=Q.isInstancedMesh===!0,Ue=Q.isBatchedMesh===!0,Te=!!S.map,qe=!!S.matcap,O=!!j,bt=!!S.aoMap,xe=!!S.lightMap,Pe=!!S.bumpMap,pe=!!S.normalMap,tt=!!S.displacementMap,Fe=!!S.emissiveMap,A=!!S.metalnessMap,x=!!S.roughnessMap,B=S.anisotropy>0,ee=S.clearcoat>0,Z=S.iridescence>0,te=S.sheen>0,me=S.transmission>0,le=B&&!!S.anisotropyMap,de=ee&&!!S.clearcoatMap,Ee=ee&&!!S.clearcoatNormalMap,Be=ee&&!!S.clearcoatRoughnessMap,J=Z&&!!S.iridescenceMap,je=Z&&!!S.iridescenceThicknessMap,Ve=te&&!!S.sheenColorMap,Ce=te&&!!S.sheenRoughnessMap,Me=!!S.specularMap,fe=!!S.specularColorMap,Ne=!!S.specularIntensityMap,Ye=me&&!!S.transmissionMap,rt=me&&!!S.thicknessMap,ze=!!S.gradientMap,re=!!S.alphaMap,D=S.alphaTest>0,oe=!!S.alphaHash,ae=!!S.extensions,be=!!N.attributes.uv1,ye=!!N.attributes.uv2,Je=!!N.attributes.uv3;let Ze=Un;return S.toneMapped&&(_e===null||_e.isXRRenderTarget===!0)&&(Ze=i.toneMapping),{isWebGL2:u,shaderID:Y,shaderType:S.type,shaderName:S.name,vertexShader:X,fragmentShader:$,defines:S.defines,customVertexShaderID:he,customFragmentShaderID:ve,isRawShaderMaterial:S.isRawShaderMaterial===!0,glslVersion:S.glslVersion,precision:g,batching:Ue,instancing:De,instancingColor:De&&Q.instanceColor!==null,supportsVertexTextures:p,outputColorSpace:_e===null?i.outputColorSpace:_e.isXRRenderTarget===!0?_e.texture.colorSpace:xn,map:Te,matcap:qe,envMap:O,envMapMode:O&&j.mapping,envMapCubeUVHeight:q,aoMap:bt,lightMap:xe,bumpMap:Pe,normalMap:pe,displacementMap:p&&tt,emissiveMap:Fe,normalMapObjectSpace:pe&&S.normalMapType===_u,normalMapTangentSpace:pe&&S.normalMapType===Bo,metalnessMap:A,roughnessMap:x,anisotropy:B,anisotropyMap:le,clearcoat:ee,clearcoatMap:de,clearcoatNormalMap:Ee,clearcoatRoughnessMap:Be,iridescence:Z,iridescenceMap:J,iridescenceThicknessMap:je,sheen:te,sheenColorMap:Ve,sheenRoughnessMap:Ce,specularMap:Me,specularColorMap:fe,specularIntensityMap:Ne,transmission:me,transmissionMap:Ye,thicknessMap:rt,gradientMap:ze,opaque:S.transparent===!1&&S.blending===Fi,alphaMap:re,alphaTest:D,alphaHash:oe,combine:S.combine,mapUv:Te&&_(S.map.channel),aoMapUv:bt&&_(S.aoMap.channel),lightMapUv:xe&&_(S.lightMap.channel),bumpMapUv:Pe&&_(S.bumpMap.channel),normalMapUv:pe&&_(S.normalMap.channel),displacementMapUv:tt&&_(S.displacementMap.channel),emissiveMapUv:Fe&&_(S.emissiveMap.channel),metalnessMapUv:A&&_(S.metalnessMap.channel),roughnessMapUv:x&&_(S.roughnessMap.channel),anisotropyMapUv:le&&_(S.anisotropyMap.channel),clearcoatMapUv:de&&_(S.clearcoatMap.channel),clearcoatNormalMapUv:Ee&&_(S.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Be&&_(S.clearcoatRoughnessMap.channel),iridescenceMapUv:J&&_(S.iridescenceMap.channel),iridescenceThicknessMapUv:je&&_(S.iridescenceThicknessMap.channel),sheenColorMapUv:Ve&&_(S.sheenColorMap.channel),sheenRoughnessMapUv:Ce&&_(S.sheenRoughnessMap.channel),specularMapUv:Me&&_(S.specularMap.channel),specularColorMapUv:fe&&_(S.specularColorMap.channel),specularIntensityMapUv:Ne&&_(S.specularIntensityMap.channel),transmissionMapUv:Ye&&_(S.transmissionMap.channel),thicknessMapUv:rt&&_(S.thicknessMap.channel),alphaMapUv:re&&_(S.alphaMap.channel),vertexTangents:!!N.attributes.tangent&&(pe||B),vertexColors:S.vertexColors,vertexAlphas:S.vertexColors===!0&&!!N.attributes.color&&N.attributes.color.itemSize===4,vertexUv1s:be,vertexUv2s:ye,vertexUv3s:Je,pointsUvs:Q.isPoints===!0&&!!N.attributes.uv&&(Te||re),fog:!!I,useFog:S.fog===!0,fogExp2:I&&I.isFogExp2,flatShading:S.flatShading===!0,sizeAttenuation:S.sizeAttenuation===!0,logarithmicDepthBuffer:d,skinning:Q.isSkinnedMesh===!0,morphTargets:N.morphAttributes.position!==void 0,morphNormals:N.morphAttributes.normal!==void 0,morphColors:N.morphAttributes.color!==void 0,morphTargetsCount:ne,morphTextureStride:ie,numDirLights:b.directional.length,numPointLights:b.point.length,numSpotLights:b.spot.length,numSpotLightMaps:b.spotLightMap.length,numRectAreaLights:b.rectArea.length,numHemiLights:b.hemi.length,numDirLightShadows:b.directionalShadowMap.length,numPointLightShadows:b.pointShadowMap.length,numSpotLightShadows:b.spotShadowMap.length,numSpotLightShadowsWithMaps:b.numSpotLightShadowsWithMaps,numLightProbes:b.numLightProbes,numClippingPlanes:l.numPlanes,numClipIntersection:l.numIntersection,dithering:S.dithering,shadowMapEnabled:i.shadowMap.enabled&&z.length>0,shadowMapType:i.shadowMap.type,toneMapping:Ze,useLegacyLights:i._useLegacyLights,decodeVideoTexture:Te&&S.map.isVideoTexture===!0&&Ke.getTransfer(S.map.colorSpace)===et,premultipliedAlpha:S.premultipliedAlpha,doubleSided:S.side===It,flipSided:S.side===Ut,useDepthPacking:S.depthPacking>=0,depthPacking:S.depthPacking||0,index0AttributeName:S.index0AttributeName,extensionDerivatives:ae&&S.extensions.derivatives===!0,extensionFragDepth:ae&&S.extensions.fragDepth===!0,extensionDrawBuffers:ae&&S.extensions.drawBuffers===!0,extensionShaderTextureLOD:ae&&S.extensions.shaderTextureLOD===!0,extensionClipCullDistance:ae&&S.extensions.clipCullDistance&&n.has("WEBGL_clip_cull_distance"),rendererExtensionFragDepth:u||n.has("EXT_frag_depth"),rendererExtensionDrawBuffers:u||n.has("WEBGL_draw_buffers"),rendererExtensionShaderTextureLod:u||n.has("EXT_shader_texture_lod"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:S.customProgramCacheKey()}}function f(S){const b=[];if(S.shaderID?b.push(S.shaderID):(b.push(S.customVertexShaderID),b.push(S.customFragmentShaderID)),S.defines!==void 0)for(const z in S.defines)b.push(z),b.push(S.defines[z]);return S.isRawShaderMaterial===!1&&(y(b,S),M(b,S),b.push(i.outputColorSpace)),b.push(S.customProgramCacheKey),b.join()}function y(S,b){S.push(b.precision),S.push(b.outputColorSpace),S.push(b.envMapMode),S.push(b.envMapCubeUVHeight),S.push(b.mapUv),S.push(b.alphaMapUv),S.push(b.lightMapUv),S.push(b.aoMapUv),S.push(b.bumpMapUv),S.push(b.normalMapUv),S.push(b.displacementMapUv),S.push(b.emissiveMapUv),S.push(b.metalnessMapUv),S.push(b.roughnessMapUv),S.push(b.anisotropyMapUv),S.push(b.clearcoatMapUv),S.push(b.clearcoatNormalMapUv),S.push(b.clearcoatRoughnessMapUv),S.push(b.iridescenceMapUv),S.push(b.iridescenceThicknessMapUv),S.push(b.sheenColorMapUv),S.push(b.sheenRoughnessMapUv),S.push(b.specularMapUv),S.push(b.specularColorMapUv),S.push(b.specularIntensityMapUv),S.push(b.transmissionMapUv),S.push(b.thicknessMapUv),S.push(b.combine),S.push(b.fogExp2),S.push(b.sizeAttenuation),S.push(b.morphTargetsCount),S.push(b.morphAttributeCount),S.push(b.numDirLights),S.push(b.numPointLights),S.push(b.numSpotLights),S.push(b.numSpotLightMaps),S.push(b.numHemiLights),S.push(b.numRectAreaLights),S.push(b.numDirLightShadows),S.push(b.numPointLightShadows),S.push(b.numSpotLightShadows),S.push(b.numSpotLightShadowsWithMaps),S.push(b.numLightProbes),S.push(b.shadowMapType),S.push(b.toneMapping),S.push(b.numClippingPlanes),S.push(b.numClipIntersection),S.push(b.depthPacking)}function M(S,b){o.disableAll(),b.isWebGL2&&o.enable(0),b.supportsVertexTextures&&o.enable(1),b.instancing&&o.enable(2),b.instancingColor&&o.enable(3),b.matcap&&o.enable(4),b.envMap&&o.enable(5),b.normalMapObjectSpace&&o.enable(6),b.normalMapTangentSpace&&o.enable(7),b.clearcoat&&o.enable(8),b.iridescence&&o.enable(9),b.alphaTest&&o.enable(10),b.vertexColors&&o.enable(11),b.vertexAlphas&&o.enable(12),b.vertexUv1s&&o.enable(13),b.vertexUv2s&&o.enable(14),b.vertexUv3s&&o.enable(15),b.vertexTangents&&o.enable(16),b.anisotropy&&o.enable(17),b.alphaHash&&o.enable(18),b.batching&&o.enable(19),S.push(o.mask),o.disableAll(),b.fog&&o.enable(0),b.useFog&&o.enable(1),b.flatShading&&o.enable(2),b.logarithmicDepthBuffer&&o.enable(3),b.skinning&&o.enable(4),b.morphTargets&&o.enable(5),b.morphNormals&&o.enable(6),b.morphColors&&o.enable(7),b.premultipliedAlpha&&o.enable(8),b.shadowMapEnabled&&o.enable(9),b.useLegacyLights&&o.enable(10),b.doubleSided&&o.enable(11),b.flipSided&&o.enable(12),b.useDepthPacking&&o.enable(13),b.dithering&&o.enable(14),b.transmission&&o.enable(15),b.sheen&&o.enable(16),b.opaque&&o.enable(17),b.pointsUvs&&o.enable(18),b.decodeVideoTexture&&o.enable(19),S.push(o.mask)}function T(S){const b=v[S.type];let z;if(b){const k=cn[b];z=Wu.clone(k.uniforms)}else z=S.uniforms;return z}function L(S,b){let z;for(let k=0,Q=h.length;k<Q;k++){const I=h[k];if(I.cacheKey===b){z=I,++z.usedTimes;break}}return z===void 0&&(z=new sg(i,b,S,s),h.push(z)),z}function R(S){if(--S.usedTimes===0){const b=h.indexOf(S);h[b]=h[h.length-1],h.pop(),S.destroy()}}function C(S){c.remove(S)}function V(){c.dispose()}return{getParameters:m,getProgramCacheKey:f,getUniforms:T,acquireProgram:L,releaseProgram:R,releaseShaderCache:C,programs:h,dispose:V}}function hg(){let i=new WeakMap;function e(s){let l=i.get(s);return l===void 0&&(l={},i.set(s,l)),l}function t(s){i.delete(s)}function n(s,l,o){i.get(s)[l]=o}function r(){i=new WeakMap}return{get:e,remove:t,update:n,dispose:r}}function ug(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.z!==e.z?i.z-e.z:i.id-e.id}function Ml(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function xl(){const i=[];let e=0;const t=[],n=[],r=[];function s(){e=0,t.length=0,n.length=0,r.length=0}function l(d,p,g,v,_,m){let f=i[e];return f===void 0?(f={id:d.id,object:d,geometry:p,material:g,groupOrder:v,renderOrder:d.renderOrder,z:_,group:m},i[e]=f):(f.id=d.id,f.object=d,f.geometry=p,f.material=g,f.groupOrder=v,f.renderOrder=d.renderOrder,f.z=_,f.group=m),e++,f}function o(d,p,g,v,_,m){const f=l(d,p,g,v,_,m);g.transmission>0?n.push(f):g.transparent===!0?r.push(f):t.push(f)}function c(d,p,g,v,_,m){const f=l(d,p,g,v,_,m);g.transmission>0?n.unshift(f):g.transparent===!0?r.unshift(f):t.unshift(f)}function h(d,p){t.length>1&&t.sort(d||ug),n.length>1&&n.sort(p||Ml),r.length>1&&r.sort(p||Ml)}function u(){for(let d=e,p=i.length;d<p;d++){const g=i[d];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:t,transmissive:n,transparent:r,init:s,push:o,unshift:c,finish:u,sort:h}}function dg(){let i=new WeakMap;function e(n,r){const s=i.get(n);let l;return s===void 0?(l=new xl,i.set(n,[l])):r>=s.length?(l=new xl,s.push(l)):l=s[r],l}function t(){i=new WeakMap}return{get:e,dispose:t}}function fg(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new P,color:new We};break;case"SpotLight":t={position:new P,direction:new P,color:new We,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new P,color:new We,distance:0,decay:0};break;case"HemisphereLight":t={direction:new P,skyColor:new We,groundColor:new We};break;case"RectAreaLight":t={color:new We,position:new P,halfWidth:new P,halfHeight:new P};break}return i[e.id]=t,t}}}function pg(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Re};break;case"SpotLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Re};break;case"PointLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Re,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[e.id]=t,t}}}let mg=0;function gg(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function _g(i,e){const t=new fg,n=pg(),r={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let u=0;u<9;u++)r.probe.push(new P);const s=new P,l=new it,o=new it;function c(u,d){let p=0,g=0,v=0;for(let k=0;k<9;k++)r.probe[k].set(0,0,0);let _=0,m=0,f=0,y=0,M=0,T=0,L=0,R=0,C=0,V=0,S=0;u.sort(gg);const b=d===!0?Math.PI:1;for(let k=0,Q=u.length;k<Q;k++){const I=u[k],N=I.color,W=I.intensity,j=I.distance,q=I.shadow&&I.shadow.map?I.shadow.map.texture:null;if(I.isAmbientLight)p+=N.r*W*b,g+=N.g*W*b,v+=N.b*W*b;else if(I.isLightProbe){for(let Y=0;Y<9;Y++)r.probe[Y].addScaledVector(I.sh.coefficients[Y],W);S++}else if(I.isDirectionalLight){const Y=t.get(I);if(Y.color.copy(I.color).multiplyScalar(I.intensity*b),I.castShadow){const K=I.shadow,ne=n.get(I);ne.shadowBias=K.bias,ne.shadowNormalBias=K.normalBias,ne.shadowRadius=K.radius,ne.shadowMapSize=K.mapSize,r.directionalShadow[_]=ne,r.directionalShadowMap[_]=q,r.directionalShadowMatrix[_]=I.shadow.matrix,T++}r.directional[_]=Y,_++}else if(I.isSpotLight){const Y=t.get(I);Y.position.setFromMatrixPosition(I.matrixWorld),Y.color.copy(N).multiplyScalar(W*b),Y.distance=j,Y.coneCos=Math.cos(I.angle),Y.penumbraCos=Math.cos(I.angle*(1-I.penumbra)),Y.decay=I.decay,r.spot[f]=Y;const K=I.shadow;if(I.map&&(r.spotLightMap[C]=I.map,C++,K.updateMatrices(I),I.castShadow&&V++),r.spotLightMatrix[f]=K.matrix,I.castShadow){const ne=n.get(I);ne.shadowBias=K.bias,ne.shadowNormalBias=K.normalBias,ne.shadowRadius=K.radius,ne.shadowMapSize=K.mapSize,r.spotShadow[f]=ne,r.spotShadowMap[f]=q,R++}f++}else if(I.isRectAreaLight){const Y=t.get(I);Y.color.copy(N).multiplyScalar(W),Y.halfWidth.set(I.width*.5,0,0),Y.halfHeight.set(0,I.height*.5,0),r.rectArea[y]=Y,y++}else if(I.isPointLight){const Y=t.get(I);if(Y.color.copy(I.color).multiplyScalar(I.intensity*b),Y.distance=I.distance,Y.decay=I.decay,I.castShadow){const K=I.shadow,ne=n.get(I);ne.shadowBias=K.bias,ne.shadowNormalBias=K.normalBias,ne.shadowRadius=K.radius,ne.shadowMapSize=K.mapSize,ne.shadowCameraNear=K.camera.near,ne.shadowCameraFar=K.camera.far,r.pointShadow[m]=ne,r.pointShadowMap[m]=q,r.pointShadowMatrix[m]=I.shadow.matrix,L++}r.point[m]=Y,m++}else if(I.isHemisphereLight){const Y=t.get(I);Y.skyColor.copy(I.color).multiplyScalar(W*b),Y.groundColor.copy(I.groundColor).multiplyScalar(W*b),r.hemi[M]=Y,M++}}y>0&&(e.isWebGL2?i.has("OES_texture_float_linear")===!0?(r.rectAreaLTC1=se.LTC_FLOAT_1,r.rectAreaLTC2=se.LTC_FLOAT_2):(r.rectAreaLTC1=se.LTC_HALF_1,r.rectAreaLTC2=se.LTC_HALF_2):i.has("OES_texture_float_linear")===!0?(r.rectAreaLTC1=se.LTC_FLOAT_1,r.rectAreaLTC2=se.LTC_FLOAT_2):i.has("OES_texture_half_float_linear")===!0?(r.rectAreaLTC1=se.LTC_HALF_1,r.rectAreaLTC2=se.LTC_HALF_2):console.error("THREE.WebGLRenderer: Unable to use RectAreaLight. Missing WebGL extensions.")),r.ambient[0]=p,r.ambient[1]=g,r.ambient[2]=v;const z=r.hash;(z.directionalLength!==_||z.pointLength!==m||z.spotLength!==f||z.rectAreaLength!==y||z.hemiLength!==M||z.numDirectionalShadows!==T||z.numPointShadows!==L||z.numSpotShadows!==R||z.numSpotMaps!==C||z.numLightProbes!==S)&&(r.directional.length=_,r.spot.length=f,r.rectArea.length=y,r.point.length=m,r.hemi.length=M,r.directionalShadow.length=T,r.directionalShadowMap.length=T,r.pointShadow.length=L,r.pointShadowMap.length=L,r.spotShadow.length=R,r.spotShadowMap.length=R,r.directionalShadowMatrix.length=T,r.pointShadowMatrix.length=L,r.spotLightMatrix.length=R+C-V,r.spotLightMap.length=C,r.numSpotLightShadowsWithMaps=V,r.numLightProbes=S,z.directionalLength=_,z.pointLength=m,z.spotLength=f,z.rectAreaLength=y,z.hemiLength=M,z.numDirectionalShadows=T,z.numPointShadows=L,z.numSpotShadows=R,z.numSpotMaps=C,z.numLightProbes=S,r.version=mg++)}function h(u,d){let p=0,g=0,v=0,_=0,m=0;const f=d.matrixWorldInverse;for(let y=0,M=u.length;y<M;y++){const T=u[y];if(T.isDirectionalLight){const L=r.directional[p];L.direction.setFromMatrixPosition(T.matrixWorld),s.setFromMatrixPosition(T.target.matrixWorld),L.direction.sub(s),L.direction.transformDirection(f),p++}else if(T.isSpotLight){const L=r.spot[v];L.position.setFromMatrixPosition(T.matrixWorld),L.position.applyMatrix4(f),L.direction.setFromMatrixPosition(T.matrixWorld),s.setFromMatrixPosition(T.target.matrixWorld),L.direction.sub(s),L.direction.transformDirection(f),v++}else if(T.isRectAreaLight){const L=r.rectArea[_];L.position.setFromMatrixPosition(T.matrixWorld),L.position.applyMatrix4(f),o.identity(),l.copy(T.matrixWorld),l.premultiply(f),o.extractRotation(l),L.halfWidth.set(T.width*.5,0,0),L.halfHeight.set(0,T.height*.5,0),L.halfWidth.applyMatrix4(o),L.halfHeight.applyMatrix4(o),_++}else if(T.isPointLight){const L=r.point[g];L.position.setFromMatrixPosition(T.matrixWorld),L.position.applyMatrix4(f),g++}else if(T.isHemisphereLight){const L=r.hemi[m];L.direction.setFromMatrixPosition(T.matrixWorld),L.direction.transformDirection(f),m++}}}return{setup:c,setupView:h,state:r}}function yl(i,e){const t=new _g(i,e),n=[],r=[];function s(){n.length=0,r.length=0}function l(d){n.push(d)}function o(d){r.push(d)}function c(d){t.setup(n,d)}function h(d){t.setupView(n,d)}return{init:s,state:{lightsArray:n,shadowsArray:r,lights:t},setupLights:c,setupLightsView:h,pushLight:l,pushShadow:o}}function vg(i,e){let t=new WeakMap;function n(s,l=0){const o=t.get(s);let c;return o===void 0?(c=new yl(i,e),t.set(s,[c])):l>=o.length?(c=new yl(i,e),o.push(c)):c=o[l],c}function r(){t=new WeakMap}return{get:n,dispose:r}}class Mg extends ci{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=mu,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class xg extends ci{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}const yg=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Sg=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function Eg(i,e,t){let n=new ko;const r=new Re,s=new Re,l=new mt,o=new Mg({depthPacking:gu}),c=new xg,h={},u=t.maxTextureSize,d={[Fn]:Ut,[Ut]:Fn,[It]:It},p=new ri({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Re},radius:{value:4}},vertexShader:yg,fragmentShader:Sg}),g=p.clone();g.defines.HORIZONTAL_PASS=1;const v=new Zt;v.setAttribute("position",new $t(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const _=new ce(v,p),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=vc;let f=this.type;this.render=function(R,C,V){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||R.length===0)return;const S=i.getRenderTarget(),b=i.getActiveCubeFace(),z=i.getActiveMipmapLevel(),k=i.state;k.setBlending(In),k.buffers.color.setClear(1,1,1,1),k.buffers.depth.setTest(!0),k.setScissorTest(!1);const Q=f!==gn&&this.type===gn,I=f===gn&&this.type!==gn;for(let N=0,W=R.length;N<W;N++){const j=R[N],q=j.shadow;if(q===void 0){console.warn("THREE.WebGLShadowMap:",j,"has no shadow.");continue}if(q.autoUpdate===!1&&q.needsUpdate===!1)continue;r.copy(q.mapSize);const Y=q.getFrameExtents();if(r.multiply(Y),s.copy(q.mapSize),(r.x>u||r.y>u)&&(r.x>u&&(s.x=Math.floor(u/Y.x),r.x=s.x*Y.x,q.mapSize.x=s.x),r.y>u&&(s.y=Math.floor(u/Y.y),r.y=s.y*Y.y,q.mapSize.y=s.y)),q.map===null||Q===!0||I===!0){const ne=this.type!==gn?{minFilter:Pt,magFilter:Pt}:{};q.map!==null&&q.map.dispose(),q.map=new ii(r.x,r.y,ne),q.map.texture.name=j.name+".shadowMap",q.camera.updateProjectionMatrix()}i.setRenderTarget(q.map),i.clear();const K=q.getViewportCount();for(let ne=0;ne<K;ne++){const ie=q.getViewport(ne);l.set(s.x*ie.x,s.y*ie.y,s.x*ie.z,s.y*ie.w),k.viewport(l),q.updateMatrices(j,ne),n=q.getFrustum(),T(C,V,q.camera,j,this.type)}q.isPointLightShadow!==!0&&this.type===gn&&y(q,V),q.needsUpdate=!1}f=this.type,m.needsUpdate=!1,i.setRenderTarget(S,b,z)};function y(R,C){const V=e.update(_);p.defines.VSM_SAMPLES!==R.blurSamples&&(p.defines.VSM_SAMPLES=R.blurSamples,g.defines.VSM_SAMPLES=R.blurSamples,p.needsUpdate=!0,g.needsUpdate=!0),R.mapPass===null&&(R.mapPass=new ii(r.x,r.y)),p.uniforms.shadow_pass.value=R.map.texture,p.uniforms.resolution.value=R.mapSize,p.uniforms.radius.value=R.radius,i.setRenderTarget(R.mapPass),i.clear(),i.renderBufferDirect(C,null,V,p,_,null),g.uniforms.shadow_pass.value=R.mapPass.texture,g.uniforms.resolution.value=R.mapSize,g.uniforms.radius.value=R.radius,i.setRenderTarget(R.map),i.clear(),i.renderBufferDirect(C,null,V,g,_,null)}function M(R,C,V,S){let b=null;const z=V.isPointLight===!0?R.customDistanceMaterial:R.customDepthMaterial;if(z!==void 0)b=z;else if(b=V.isPointLight===!0?c:o,i.localClippingEnabled&&C.clipShadows===!0&&Array.isArray(C.clippingPlanes)&&C.clippingPlanes.length!==0||C.displacementMap&&C.displacementScale!==0||C.alphaMap&&C.alphaTest>0||C.map&&C.alphaTest>0){const k=b.uuid,Q=C.uuid;let I=h[k];I===void 0&&(I={},h[k]=I);let N=I[Q];N===void 0&&(N=b.clone(),I[Q]=N,C.addEventListener("dispose",L)),b=N}if(b.visible=C.visible,b.wireframe=C.wireframe,S===gn?b.side=C.shadowSide!==null?C.shadowSide:C.side:b.side=C.shadowSide!==null?C.shadowSide:d[C.side],b.alphaMap=C.alphaMap,b.alphaTest=C.alphaTest,b.map=C.map,b.clipShadows=C.clipShadows,b.clippingPlanes=C.clippingPlanes,b.clipIntersection=C.clipIntersection,b.displacementMap=C.displacementMap,b.displacementScale=C.displacementScale,b.displacementBias=C.displacementBias,b.wireframeLinewidth=C.wireframeLinewidth,b.linewidth=C.linewidth,V.isPointLight===!0&&b.isMeshDistanceMaterial===!0){const k=i.properties.get(b);k.light=V}return b}function T(R,C,V,S,b){if(R.visible===!1)return;if(R.layers.test(C.layers)&&(R.isMesh||R.isLine||R.isPoints)&&(R.castShadow||R.receiveShadow&&b===gn)&&(!R.frustumCulled||n.intersectsObject(R))){R.modelViewMatrix.multiplyMatrices(V.matrixWorldInverse,R.matrixWorld);const Q=e.update(R),I=R.material;if(Array.isArray(I)){const N=Q.groups;for(let W=0,j=N.length;W<j;W++){const q=N[W],Y=I[q.materialIndex];if(Y&&Y.visible){const K=M(R,Y,S,b);R.onBeforeShadow(i,R,C,V,Q,K,q),i.renderBufferDirect(V,null,Q,K,R,q),R.onAfterShadow(i,R,C,V,Q,K,q)}}}else if(I.visible){const N=M(R,I,S,b);R.onBeforeShadow(i,R,C,V,Q,N,null),i.renderBufferDirect(V,null,Q,N,R,null),R.onAfterShadow(i,R,C,V,Q,N,null)}}const k=R.children;for(let Q=0,I=k.length;Q<I;Q++)T(k[Q],C,V,S,b)}function L(R){R.target.removeEventListener("dispose",L);for(const V in h){const S=h[V],b=R.target.uuid;b in S&&(S[b].dispose(),delete S[b])}}}function Tg(i,e,t){const n=t.isWebGL2;function r(){let D=!1;const oe=new mt;let ae=null;const be=new mt(0,0,0,0);return{setMask:function(ye){ae!==ye&&!D&&(i.colorMask(ye,ye,ye,ye),ae=ye)},setLocked:function(ye){D=ye},setClear:function(ye,Je,Ze,dt,At){At===!0&&(ye*=dt,Je*=dt,Ze*=dt),oe.set(ye,Je,Ze,dt),be.equals(oe)===!1&&(i.clearColor(ye,Je,Ze,dt),be.copy(oe))},reset:function(){D=!1,ae=null,be.set(-1,0,0,0)}}}function s(){let D=!1,oe=null,ae=null,be=null;return{setTest:function(ye){ye?Ue(i.DEPTH_TEST):Te(i.DEPTH_TEST)},setMask:function(ye){oe!==ye&&!D&&(i.depthMask(ye),oe=ye)},setFunc:function(ye){if(ae!==ye){switch(ye){case Xh:i.depthFunc(i.NEVER);break;case qh:i.depthFunc(i.ALWAYS);break;case Yh:i.depthFunc(i.LESS);break;case es:i.depthFunc(i.LEQUAL);break;case jh:i.depthFunc(i.EQUAL);break;case Kh:i.depthFunc(i.GEQUAL);break;case $h:i.depthFunc(i.GREATER);break;case Jh:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}ae=ye}},setLocked:function(ye){D=ye},setClear:function(ye){be!==ye&&(i.clearDepth(ye),be=ye)},reset:function(){D=!1,oe=null,ae=null,be=null}}}function l(){let D=!1,oe=null,ae=null,be=null,ye=null,Je=null,Ze=null,dt=null,At=null;return{setTest:function(Qe){D||(Qe?Ue(i.STENCIL_TEST):Te(i.STENCIL_TEST))},setMask:function(Qe){oe!==Qe&&!D&&(i.stencilMask(Qe),oe=Qe)},setFunc:function(Qe,wt,ln){(ae!==Qe||be!==wt||ye!==ln)&&(i.stencilFunc(Qe,wt,ln),ae=Qe,be=wt,ye=ln)},setOp:function(Qe,wt,ln){(Je!==Qe||Ze!==wt||dt!==ln)&&(i.stencilOp(Qe,wt,ln),Je=Qe,Ze=wt,dt=ln)},setLocked:function(Qe){D=Qe},setClear:function(Qe){At!==Qe&&(i.clearStencil(Qe),At=Qe)},reset:function(){D=!1,oe=null,ae=null,be=null,ye=null,Je=null,Ze=null,dt=null,At=null}}}const o=new r,c=new s,h=new l,u=new WeakMap,d=new WeakMap;let p={},g={},v=new WeakMap,_=[],m=null,f=!1,y=null,M=null,T=null,L=null,R=null,C=null,V=null,S=new We(0,0,0),b=0,z=!1,k=null,Q=null,I=null,N=null,W=null;const j=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let q=!1,Y=0;const K=i.getParameter(i.VERSION);K.indexOf("WebGL")!==-1?(Y=parseFloat(/^WebGL (\d)/.exec(K)[1]),q=Y>=1):K.indexOf("OpenGL ES")!==-1&&(Y=parseFloat(/^OpenGL ES (\d)/.exec(K)[1]),q=Y>=2);let ne=null,ie={};const X=i.getParameter(i.SCISSOR_BOX),$=i.getParameter(i.VIEWPORT),he=new mt().fromArray(X),ve=new mt().fromArray($);function _e(D,oe,ae,be){const ye=new Uint8Array(4),Je=i.createTexture();i.bindTexture(D,Je),i.texParameteri(D,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(D,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Ze=0;Ze<ae;Ze++)n&&(D===i.TEXTURE_3D||D===i.TEXTURE_2D_ARRAY)?i.texImage3D(oe,0,i.RGBA,1,1,be,0,i.RGBA,i.UNSIGNED_BYTE,ye):i.texImage2D(oe+Ze,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,ye);return Je}const De={};De[i.TEXTURE_2D]=_e(i.TEXTURE_2D,i.TEXTURE_2D,1),De[i.TEXTURE_CUBE_MAP]=_e(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),n&&(De[i.TEXTURE_2D_ARRAY]=_e(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),De[i.TEXTURE_3D]=_e(i.TEXTURE_3D,i.TEXTURE_3D,1,1)),o.setClear(0,0,0,1),c.setClear(1),h.setClear(0),Ue(i.DEPTH_TEST),c.setFunc(es),Fe(!1),A(ia),Ue(i.CULL_FACE),pe(In);function Ue(D){p[D]!==!0&&(i.enable(D),p[D]=!0)}function Te(D){p[D]!==!1&&(i.disable(D),p[D]=!1)}function qe(D,oe){return g[D]!==oe?(i.bindFramebuffer(D,oe),g[D]=oe,n&&(D===i.DRAW_FRAMEBUFFER&&(g[i.FRAMEBUFFER]=oe),D===i.FRAMEBUFFER&&(g[i.DRAW_FRAMEBUFFER]=oe)),!0):!1}function O(D,oe){let ae=_,be=!1;if(D)if(ae=v.get(oe),ae===void 0&&(ae=[],v.set(oe,ae)),D.isWebGLMultipleRenderTargets){const ye=D.texture;if(ae.length!==ye.length||ae[0]!==i.COLOR_ATTACHMENT0){for(let Je=0,Ze=ye.length;Je<Ze;Je++)ae[Je]=i.COLOR_ATTACHMENT0+Je;ae.length=ye.length,be=!0}}else ae[0]!==i.COLOR_ATTACHMENT0&&(ae[0]=i.COLOR_ATTACHMENT0,be=!0);else ae[0]!==i.BACK&&(ae[0]=i.BACK,be=!0);be&&(t.isWebGL2?i.drawBuffers(ae):e.get("WEBGL_draw_buffers").drawBuffersWEBGL(ae))}function bt(D){return m!==D?(i.useProgram(D),m=D,!0):!1}const xe={[Jn]:i.FUNC_ADD,[Ph]:i.FUNC_SUBTRACT,[Lh]:i.FUNC_REVERSE_SUBTRACT};if(n)xe[aa]=i.MIN,xe[la]=i.MAX;else{const D=e.get("EXT_blend_minmax");D!==null&&(xe[aa]=D.MIN_EXT,xe[la]=D.MAX_EXT)}const Pe={[Dh]:i.ZERO,[Ih]:i.ONE,[Uh]:i.SRC_COLOR,[yo]:i.SRC_ALPHA,[zh]:i.SRC_ALPHA_SATURATE,[Bh]:i.DST_COLOR,[Oh]:i.DST_ALPHA,[Nh]:i.ONE_MINUS_SRC_COLOR,[So]:i.ONE_MINUS_SRC_ALPHA,[Gh]:i.ONE_MINUS_DST_COLOR,[Fh]:i.ONE_MINUS_DST_ALPHA,[kh]:i.CONSTANT_COLOR,[Hh]:i.ONE_MINUS_CONSTANT_COLOR,[Vh]:i.CONSTANT_ALPHA,[Wh]:i.ONE_MINUS_CONSTANT_ALPHA};function pe(D,oe,ae,be,ye,Je,Ze,dt,At,Qe){if(D===In){f===!0&&(Te(i.BLEND),f=!1);return}if(f===!1&&(Ue(i.BLEND),f=!0),D!==Ch){if(D!==y||Qe!==z){if((M!==Jn||R!==Jn)&&(i.blendEquation(i.FUNC_ADD),M=Jn,R=Jn),Qe)switch(D){case Fi:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case ra:i.blendFunc(i.ONE,i.ONE);break;case sa:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case oa:i.blendFuncSeparate(i.ZERO,i.SRC_COLOR,i.ZERO,i.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}else switch(D){case Fi:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case ra:i.blendFunc(i.SRC_ALPHA,i.ONE);break;case sa:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case oa:i.blendFunc(i.ZERO,i.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}T=null,L=null,C=null,V=null,S.set(0,0,0),b=0,y=D,z=Qe}return}ye=ye||oe,Je=Je||ae,Ze=Ze||be,(oe!==M||ye!==R)&&(i.blendEquationSeparate(xe[oe],xe[ye]),M=oe,R=ye),(ae!==T||be!==L||Je!==C||Ze!==V)&&(i.blendFuncSeparate(Pe[ae],Pe[be],Pe[Je],Pe[Ze]),T=ae,L=be,C=Je,V=Ze),(dt.equals(S)===!1||At!==b)&&(i.blendColor(dt.r,dt.g,dt.b,At),S.copy(dt),b=At),y=D,z=!1}function tt(D,oe){D.side===It?Te(i.CULL_FACE):Ue(i.CULL_FACE);let ae=D.side===Ut;oe&&(ae=!ae),Fe(ae),D.blending===Fi&&D.transparent===!1?pe(In):pe(D.blending,D.blendEquation,D.blendSrc,D.blendDst,D.blendEquationAlpha,D.blendSrcAlpha,D.blendDstAlpha,D.blendColor,D.blendAlpha,D.premultipliedAlpha),c.setFunc(D.depthFunc),c.setTest(D.depthTest),c.setMask(D.depthWrite),o.setMask(D.colorWrite);const be=D.stencilWrite;h.setTest(be),be&&(h.setMask(D.stencilWriteMask),h.setFunc(D.stencilFunc,D.stencilRef,D.stencilFuncMask),h.setOp(D.stencilFail,D.stencilZFail,D.stencilZPass)),B(D.polygonOffset,D.polygonOffsetFactor,D.polygonOffsetUnits),D.alphaToCoverage===!0?Ue(i.SAMPLE_ALPHA_TO_COVERAGE):Te(i.SAMPLE_ALPHA_TO_COVERAGE)}function Fe(D){k!==D&&(D?i.frontFace(i.CW):i.frontFace(i.CCW),k=D)}function A(D){D!==wh?(Ue(i.CULL_FACE),D!==Q&&(D===ia?i.cullFace(i.BACK):D===Rh?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):Te(i.CULL_FACE),Q=D}function x(D){D!==I&&(q&&i.lineWidth(D),I=D)}function B(D,oe,ae){D?(Ue(i.POLYGON_OFFSET_FILL),(N!==oe||W!==ae)&&(i.polygonOffset(oe,ae),N=oe,W=ae)):Te(i.POLYGON_OFFSET_FILL)}function ee(D){D?Ue(i.SCISSOR_TEST):Te(i.SCISSOR_TEST)}function Z(D){D===void 0&&(D=i.TEXTURE0+j-1),ne!==D&&(i.activeTexture(D),ne=D)}function te(D,oe,ae){ae===void 0&&(ne===null?ae=i.TEXTURE0+j-1:ae=ne);let be=ie[ae];be===void 0&&(be={type:void 0,texture:void 0},ie[ae]=be),(be.type!==D||be.texture!==oe)&&(ne!==ae&&(i.activeTexture(ae),ne=ae),i.bindTexture(D,oe||De[D]),be.type=D,be.texture=oe)}function me(){const D=ie[ne];D!==void 0&&D.type!==void 0&&(i.bindTexture(D.type,null),D.type=void 0,D.texture=void 0)}function le(){try{i.compressedTexImage2D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function de(){try{i.compressedTexImage3D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Ee(){try{i.texSubImage2D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Be(){try{i.texSubImage3D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function J(){try{i.compressedTexSubImage2D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function je(){try{i.compressedTexSubImage3D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Ve(){try{i.texStorage2D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Ce(){try{i.texStorage3D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Me(){try{i.texImage2D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function fe(){try{i.texImage3D.apply(i,arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Ne(D){he.equals(D)===!1&&(i.scissor(D.x,D.y,D.z,D.w),he.copy(D))}function Ye(D){ve.equals(D)===!1&&(i.viewport(D.x,D.y,D.z,D.w),ve.copy(D))}function rt(D,oe){let ae=d.get(oe);ae===void 0&&(ae=new WeakMap,d.set(oe,ae));let be=ae.get(D);be===void 0&&(be=i.getUniformBlockIndex(oe,D.name),ae.set(D,be))}function ze(D,oe){const be=d.get(oe).get(D);u.get(oe)!==be&&(i.uniformBlockBinding(oe,be,D.__bindingPointIndex),u.set(oe,be))}function re(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),n===!0&&(i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null)),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),p={},ne=null,ie={},g={},v=new WeakMap,_=[],m=null,f=!1,y=null,M=null,T=null,L=null,R=null,C=null,V=null,S=new We(0,0,0),b=0,z=!1,k=null,Q=null,I=null,N=null,W=null,he.set(0,0,i.canvas.width,i.canvas.height),ve.set(0,0,i.canvas.width,i.canvas.height),o.reset(),c.reset(),h.reset()}return{buffers:{color:o,depth:c,stencil:h},enable:Ue,disable:Te,bindFramebuffer:qe,drawBuffers:O,useProgram:bt,setBlending:pe,setMaterial:tt,setFlipSided:Fe,setCullFace:A,setLineWidth:x,setPolygonOffset:B,setScissorTest:ee,activeTexture:Z,bindTexture:te,unbindTexture:me,compressedTexImage2D:le,compressedTexImage3D:de,texImage2D:Me,texImage3D:fe,updateUBOMapping:rt,uniformBlockBinding:ze,texStorage2D:Ve,texStorage3D:Ce,texSubImage2D:Ee,texSubImage3D:Be,compressedTexSubImage2D:J,compressedTexSubImage3D:je,scissor:Ne,viewport:Ye,reset:re}}function bg(i,e,t,n,r,s,l){const o=r.isWebGL2,c=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,h=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),u=new WeakMap;let d;const p=new WeakMap;let g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function v(A,x){return g?new OffscreenCanvas(A,x):ss("canvas")}function _(A,x,B,ee){let Z=1;if((A.width>ee||A.height>ee)&&(Z=ee/Math.max(A.width,A.height)),Z<1||x===!0)if(typeof HTMLImageElement<"u"&&A instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&A instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&A instanceof ImageBitmap){const te=x?Co:Math.floor,me=te(Z*A.width),le=te(Z*A.height);d===void 0&&(d=v(me,le));const de=B?v(me,le):d;return de.width=me,de.height=le,de.getContext("2d").drawImage(A,0,0,me,le),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+A.width+"x"+A.height+") to ("+me+"x"+le+")."),de}else return"data"in A&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+A.width+"x"+A.height+")."),A;return A}function m(A){return Fa(A.width)&&Fa(A.height)}function f(A){return o?!1:A.wrapS!==rn||A.wrapT!==rn||A.minFilter!==Pt&&A.minFilter!==Wt}function y(A,x){return A.generateMipmaps&&x&&A.minFilter!==Pt&&A.minFilter!==Wt}function M(A){i.generateMipmap(A)}function T(A,x,B,ee,Z=!1){if(o===!1)return x;if(A!==null){if(i[A]!==void 0)return i[A];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+A+"'")}let te=x;if(x===i.RED&&(B===i.FLOAT&&(te=i.R32F),B===i.HALF_FLOAT&&(te=i.R16F),B===i.UNSIGNED_BYTE&&(te=i.R8)),x===i.RED_INTEGER&&(B===i.UNSIGNED_BYTE&&(te=i.R8UI),B===i.UNSIGNED_SHORT&&(te=i.R16UI),B===i.UNSIGNED_INT&&(te=i.R32UI),B===i.BYTE&&(te=i.R8I),B===i.SHORT&&(te=i.R16I),B===i.INT&&(te=i.R32I)),x===i.RG&&(B===i.FLOAT&&(te=i.RG32F),B===i.HALF_FLOAT&&(te=i.RG16F),B===i.UNSIGNED_BYTE&&(te=i.RG8)),x===i.RGBA){const me=Z?ts:Ke.getTransfer(ee);B===i.FLOAT&&(te=i.RGBA32F),B===i.HALF_FLOAT&&(te=i.RGBA16F),B===i.UNSIGNED_BYTE&&(te=me===et?i.SRGB8_ALPHA8:i.RGBA8),B===i.UNSIGNED_SHORT_4_4_4_4&&(te=i.RGBA4),B===i.UNSIGNED_SHORT_5_5_5_1&&(te=i.RGB5_A1)}return(te===i.R16F||te===i.R32F||te===i.RG16F||te===i.RG32F||te===i.RGBA16F||te===i.RGBA32F)&&e.get("EXT_color_buffer_float"),te}function L(A,x,B){return y(A,B)===!0||A.isFramebufferTexture&&A.minFilter!==Pt&&A.minFilter!==Wt?Math.log2(Math.max(x.width,x.height))+1:A.mipmaps!==void 0&&A.mipmaps.length>0?A.mipmaps.length:A.isCompressedTexture&&Array.isArray(A.image)?x.mipmaps.length:1}function R(A){return A===Pt||A===ca||A===ws?i.NEAREST:i.LINEAR}function C(A){const x=A.target;x.removeEventListener("dispose",C),S(x),x.isVideoTexture&&u.delete(x)}function V(A){const x=A.target;x.removeEventListener("dispose",V),z(x)}function S(A){const x=n.get(A);if(x.__webglInit===void 0)return;const B=A.source,ee=p.get(B);if(ee){const Z=ee[x.__cacheKey];Z.usedTimes--,Z.usedTimes===0&&b(A),Object.keys(ee).length===0&&p.delete(B)}n.remove(A)}function b(A){const x=n.get(A);i.deleteTexture(x.__webglTexture);const B=A.source,ee=p.get(B);delete ee[x.__cacheKey],l.memory.textures--}function z(A){const x=A.texture,B=n.get(A),ee=n.get(x);if(ee.__webglTexture!==void 0&&(i.deleteTexture(ee.__webglTexture),l.memory.textures--),A.depthTexture&&A.depthTexture.dispose(),A.isWebGLCubeRenderTarget)for(let Z=0;Z<6;Z++){if(Array.isArray(B.__webglFramebuffer[Z]))for(let te=0;te<B.__webglFramebuffer[Z].length;te++)i.deleteFramebuffer(B.__webglFramebuffer[Z][te]);else i.deleteFramebuffer(B.__webglFramebuffer[Z]);B.__webglDepthbuffer&&i.deleteRenderbuffer(B.__webglDepthbuffer[Z])}else{if(Array.isArray(B.__webglFramebuffer))for(let Z=0;Z<B.__webglFramebuffer.length;Z++)i.deleteFramebuffer(B.__webglFramebuffer[Z]);else i.deleteFramebuffer(B.__webglFramebuffer);if(B.__webglDepthbuffer&&i.deleteRenderbuffer(B.__webglDepthbuffer),B.__webglMultisampledFramebuffer&&i.deleteFramebuffer(B.__webglMultisampledFramebuffer),B.__webglColorRenderbuffer)for(let Z=0;Z<B.__webglColorRenderbuffer.length;Z++)B.__webglColorRenderbuffer[Z]&&i.deleteRenderbuffer(B.__webglColorRenderbuffer[Z]);B.__webglDepthRenderbuffer&&i.deleteRenderbuffer(B.__webglDepthRenderbuffer)}if(A.isWebGLMultipleRenderTargets)for(let Z=0,te=x.length;Z<te;Z++){const me=n.get(x[Z]);me.__webglTexture&&(i.deleteTexture(me.__webglTexture),l.memory.textures--),n.remove(x[Z])}n.remove(x),n.remove(A)}let k=0;function Q(){k=0}function I(){const A=k;return A>=r.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+A+" texture units while this GPU supports only "+r.maxTextures),k+=1,A}function N(A){const x=[];return x.push(A.wrapS),x.push(A.wrapT),x.push(A.wrapR||0),x.push(A.magFilter),x.push(A.minFilter),x.push(A.anisotropy),x.push(A.internalFormat),x.push(A.format),x.push(A.type),x.push(A.generateMipmaps),x.push(A.premultiplyAlpha),x.push(A.flipY),x.push(A.unpackAlignment),x.push(A.colorSpace),x.join()}function W(A,x){const B=n.get(A);if(A.isVideoTexture&&tt(A),A.isRenderTargetTexture===!1&&A.version>0&&B.__version!==A.version){const ee=A.image;if(ee===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(ee.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{he(B,A,x);return}}t.bindTexture(i.TEXTURE_2D,B.__webglTexture,i.TEXTURE0+x)}function j(A,x){const B=n.get(A);if(A.version>0&&B.__version!==A.version){he(B,A,x);return}t.bindTexture(i.TEXTURE_2D_ARRAY,B.__webglTexture,i.TEXTURE0+x)}function q(A,x){const B=n.get(A);if(A.version>0&&B.__version!==A.version){he(B,A,x);return}t.bindTexture(i.TEXTURE_3D,B.__webglTexture,i.TEXTURE0+x)}function Y(A,x){const B=n.get(A);if(A.version>0&&B.__version!==A.version){ve(B,A,x);return}t.bindTexture(i.TEXTURE_CUBE_MAP,B.__webglTexture,i.TEXTURE0+x)}const K={[ni]:i.REPEAT,[rn]:i.CLAMP_TO_EDGE,[bo]:i.MIRRORED_REPEAT},ne={[Pt]:i.NEAREST,[ca]:i.NEAREST_MIPMAP_NEAREST,[ws]:i.NEAREST_MIPMAP_LINEAR,[Wt]:i.LINEAR,[ou]:i.LINEAR_MIPMAP_NEAREST,[sr]:i.LINEAR_MIPMAP_LINEAR},ie={[vu]:i.NEVER,[Tu]:i.ALWAYS,[Mu]:i.LESS,[Cc]:i.LEQUAL,[xu]:i.EQUAL,[Eu]:i.GEQUAL,[yu]:i.GREATER,[Su]:i.NOTEQUAL};function X(A,x,B){if(B?(i.texParameteri(A,i.TEXTURE_WRAP_S,K[x.wrapS]),i.texParameteri(A,i.TEXTURE_WRAP_T,K[x.wrapT]),(A===i.TEXTURE_3D||A===i.TEXTURE_2D_ARRAY)&&i.texParameteri(A,i.TEXTURE_WRAP_R,K[x.wrapR]),i.texParameteri(A,i.TEXTURE_MAG_FILTER,ne[x.magFilter]),i.texParameteri(A,i.TEXTURE_MIN_FILTER,ne[x.minFilter])):(i.texParameteri(A,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(A,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE),(A===i.TEXTURE_3D||A===i.TEXTURE_2D_ARRAY)&&i.texParameteri(A,i.TEXTURE_WRAP_R,i.CLAMP_TO_EDGE),(x.wrapS!==rn||x.wrapT!==rn)&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.wrapS and Texture.wrapT should be set to THREE.ClampToEdgeWrapping."),i.texParameteri(A,i.TEXTURE_MAG_FILTER,R(x.magFilter)),i.texParameteri(A,i.TEXTURE_MIN_FILTER,R(x.minFilter)),x.minFilter!==Pt&&x.minFilter!==Wt&&console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.minFilter should be set to THREE.NearestFilter or THREE.LinearFilter.")),x.compareFunction&&(i.texParameteri(A,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(A,i.TEXTURE_COMPARE_FUNC,ie[x.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){const ee=e.get("EXT_texture_filter_anisotropic");if(x.magFilter===Pt||x.minFilter!==ws&&x.minFilter!==sr||x.type===Pn&&e.has("OES_texture_float_linear")===!1||o===!1&&x.type===or&&e.has("OES_texture_half_float_linear")===!1)return;(x.anisotropy>1||n.get(x).__currentAnisotropy)&&(i.texParameterf(A,ee.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(x.anisotropy,r.getMaxAnisotropy())),n.get(x).__currentAnisotropy=x.anisotropy)}}function $(A,x){let B=!1;A.__webglInit===void 0&&(A.__webglInit=!0,x.addEventListener("dispose",C));const ee=x.source;let Z=p.get(ee);Z===void 0&&(Z={},p.set(ee,Z));const te=N(x);if(te!==A.__cacheKey){Z[te]===void 0&&(Z[te]={texture:i.createTexture(),usedTimes:0},l.memory.textures++,B=!0),Z[te].usedTimes++;const me=Z[A.__cacheKey];me!==void 0&&(Z[A.__cacheKey].usedTimes--,me.usedTimes===0&&b(x)),A.__cacheKey=te,A.__webglTexture=Z[te].texture}return B}function he(A,x,B){let ee=i.TEXTURE_2D;(x.isDataArrayTexture||x.isCompressedArrayTexture)&&(ee=i.TEXTURE_2D_ARRAY),x.isData3DTexture&&(ee=i.TEXTURE_3D);const Z=$(A,x),te=x.source;t.bindTexture(ee,A.__webglTexture,i.TEXTURE0+B);const me=n.get(te);if(te.version!==me.__version||Z===!0){t.activeTexture(i.TEXTURE0+B);const le=Ke.getPrimaries(Ke.workingColorSpace),de=x.colorSpace===Kt?null:Ke.getPrimaries(x.colorSpace),Ee=x.colorSpace===Kt||le===de?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,x.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,x.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,Ee);const Be=f(x)&&m(x.image)===!1;let J=_(x.image,Be,!1,r.maxTextureSize);J=Fe(x,J);const je=m(J)||o,Ve=s.convert(x.format,x.colorSpace);let Ce=s.convert(x.type),Me=T(x.internalFormat,Ve,Ce,x.colorSpace,x.isVideoTexture);X(ee,x,je);let fe;const Ne=x.mipmaps,Ye=o&&x.isVideoTexture!==!0&&Me!==wc,rt=me.__version===void 0||Z===!0,ze=L(x,J,je);if(x.isDepthTexture)Me=i.DEPTH_COMPONENT,o?x.type===Pn?Me=i.DEPTH_COMPONENT32F:x.type===Cn?Me=i.DEPTH_COMPONENT24:x.type===Qn?Me=i.DEPTH24_STENCIL8:Me=i.DEPTH_COMPONENT16:x.type===Pn&&console.error("WebGLRenderer: Floating point depth texture requires WebGL2."),x.format===ei&&Me===i.DEPTH_COMPONENT&&x.type!==Fo&&x.type!==Cn&&(console.warn("THREE.WebGLRenderer: Use UnsignedShortType or UnsignedIntType for DepthFormat DepthTexture."),x.type=Cn,Ce=s.convert(x.type)),x.format===ki&&Me===i.DEPTH_COMPONENT&&(Me=i.DEPTH_STENCIL,x.type!==Qn&&(console.warn("THREE.WebGLRenderer: Use UnsignedInt248Type for DepthStencilFormat DepthTexture."),x.type=Qn,Ce=s.convert(x.type))),rt&&(Ye?t.texStorage2D(i.TEXTURE_2D,1,Me,J.width,J.height):t.texImage2D(i.TEXTURE_2D,0,Me,J.width,J.height,0,Ve,Ce,null));else if(x.isDataTexture)if(Ne.length>0&&je){Ye&&rt&&t.texStorage2D(i.TEXTURE_2D,ze,Me,Ne[0].width,Ne[0].height);for(let re=0,D=Ne.length;re<D;re++)fe=Ne[re],Ye?t.texSubImage2D(i.TEXTURE_2D,re,0,0,fe.width,fe.height,Ve,Ce,fe.data):t.texImage2D(i.TEXTURE_2D,re,Me,fe.width,fe.height,0,Ve,Ce,fe.data);x.generateMipmaps=!1}else Ye?(rt&&t.texStorage2D(i.TEXTURE_2D,ze,Me,J.width,J.height),t.texSubImage2D(i.TEXTURE_2D,0,0,0,J.width,J.height,Ve,Ce,J.data)):t.texImage2D(i.TEXTURE_2D,0,Me,J.width,J.height,0,Ve,Ce,J.data);else if(x.isCompressedTexture)if(x.isCompressedArrayTexture){Ye&&rt&&t.texStorage3D(i.TEXTURE_2D_ARRAY,ze,Me,Ne[0].width,Ne[0].height,J.depth);for(let re=0,D=Ne.length;re<D;re++)fe=Ne[re],x.format!==sn?Ve!==null?Ye?t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,re,0,0,0,fe.width,fe.height,J.depth,Ve,fe.data,0,0):t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,re,Me,fe.width,fe.height,J.depth,0,fe.data,0,0):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ye?t.texSubImage3D(i.TEXTURE_2D_ARRAY,re,0,0,0,fe.width,fe.height,J.depth,Ve,Ce,fe.data):t.texImage3D(i.TEXTURE_2D_ARRAY,re,Me,fe.width,fe.height,J.depth,0,Ve,Ce,fe.data)}else{Ye&&rt&&t.texStorage2D(i.TEXTURE_2D,ze,Me,Ne[0].width,Ne[0].height);for(let re=0,D=Ne.length;re<D;re++)fe=Ne[re],x.format!==sn?Ve!==null?Ye?t.compressedTexSubImage2D(i.TEXTURE_2D,re,0,0,fe.width,fe.height,Ve,fe.data):t.compressedTexImage2D(i.TEXTURE_2D,re,Me,fe.width,fe.height,0,fe.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ye?t.texSubImage2D(i.TEXTURE_2D,re,0,0,fe.width,fe.height,Ve,Ce,fe.data):t.texImage2D(i.TEXTURE_2D,re,Me,fe.width,fe.height,0,Ve,Ce,fe.data)}else if(x.isDataArrayTexture)Ye?(rt&&t.texStorage3D(i.TEXTURE_2D_ARRAY,ze,Me,J.width,J.height,J.depth),t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,J.width,J.height,J.depth,Ve,Ce,J.data)):t.texImage3D(i.TEXTURE_2D_ARRAY,0,Me,J.width,J.height,J.depth,0,Ve,Ce,J.data);else if(x.isData3DTexture)Ye?(rt&&t.texStorage3D(i.TEXTURE_3D,ze,Me,J.width,J.height,J.depth),t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,J.width,J.height,J.depth,Ve,Ce,J.data)):t.texImage3D(i.TEXTURE_3D,0,Me,J.width,J.height,J.depth,0,Ve,Ce,J.data);else if(x.isFramebufferTexture){if(rt)if(Ye)t.texStorage2D(i.TEXTURE_2D,ze,Me,J.width,J.height);else{let re=J.width,D=J.height;for(let oe=0;oe<ze;oe++)t.texImage2D(i.TEXTURE_2D,oe,Me,re,D,0,Ve,Ce,null),re>>=1,D>>=1}}else if(Ne.length>0&&je){Ye&&rt&&t.texStorage2D(i.TEXTURE_2D,ze,Me,Ne[0].width,Ne[0].height);for(let re=0,D=Ne.length;re<D;re++)fe=Ne[re],Ye?t.texSubImage2D(i.TEXTURE_2D,re,0,0,Ve,Ce,fe):t.texImage2D(i.TEXTURE_2D,re,Me,Ve,Ce,fe);x.generateMipmaps=!1}else Ye?(rt&&t.texStorage2D(i.TEXTURE_2D,ze,Me,J.width,J.height),t.texSubImage2D(i.TEXTURE_2D,0,0,0,Ve,Ce,J)):t.texImage2D(i.TEXTURE_2D,0,Me,Ve,Ce,J);y(x,je)&&M(ee),me.__version=te.version,x.onUpdate&&x.onUpdate(x)}A.__version=x.version}function ve(A,x,B){if(x.image.length!==6)return;const ee=$(A,x),Z=x.source;t.bindTexture(i.TEXTURE_CUBE_MAP,A.__webglTexture,i.TEXTURE0+B);const te=n.get(Z);if(Z.version!==te.__version||ee===!0){t.activeTexture(i.TEXTURE0+B);const me=Ke.getPrimaries(Ke.workingColorSpace),le=x.colorSpace===Kt?null:Ke.getPrimaries(x.colorSpace),de=x.colorSpace===Kt||me===le?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,x.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,x.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,de);const Ee=x.isCompressedTexture||x.image[0].isCompressedTexture,Be=x.image[0]&&x.image[0].isDataTexture,J=[];for(let re=0;re<6;re++)!Ee&&!Be?J[re]=_(x.image[re],!1,!0,r.maxCubemapSize):J[re]=Be?x.image[re].image:x.image[re],J[re]=Fe(x,J[re]);const je=J[0],Ve=m(je)||o,Ce=s.convert(x.format,x.colorSpace),Me=s.convert(x.type),fe=T(x.internalFormat,Ce,Me,x.colorSpace),Ne=o&&x.isVideoTexture!==!0,Ye=te.__version===void 0||ee===!0;let rt=L(x,je,Ve);X(i.TEXTURE_CUBE_MAP,x,Ve);let ze;if(Ee){Ne&&Ye&&t.texStorage2D(i.TEXTURE_CUBE_MAP,rt,fe,je.width,je.height);for(let re=0;re<6;re++){ze=J[re].mipmaps;for(let D=0;D<ze.length;D++){const oe=ze[D];x.format!==sn?Ce!==null?Ne?t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,D,0,0,oe.width,oe.height,Ce,oe.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,D,fe,oe.width,oe.height,0,oe.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Ne?t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,D,0,0,oe.width,oe.height,Ce,Me,oe.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,D,fe,oe.width,oe.height,0,Ce,Me,oe.data)}}}else{ze=x.mipmaps,Ne&&Ye&&(ze.length>0&&rt++,t.texStorage2D(i.TEXTURE_CUBE_MAP,rt,fe,J[0].width,J[0].height));for(let re=0;re<6;re++)if(Be){Ne?t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,0,0,J[re].width,J[re].height,Ce,Me,J[re].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,fe,J[re].width,J[re].height,0,Ce,Me,J[re].data);for(let D=0;D<ze.length;D++){const ae=ze[D].image[re].image;Ne?t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,D+1,0,0,ae.width,ae.height,Ce,Me,ae.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,D+1,fe,ae.width,ae.height,0,Ce,Me,ae.data)}}else{Ne?t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,0,0,Ce,Me,J[re]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,0,fe,Ce,Me,J[re]);for(let D=0;D<ze.length;D++){const oe=ze[D];Ne?t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,D+1,0,0,Ce,Me,oe.image[re]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+re,D+1,fe,Ce,Me,oe.image[re])}}}y(x,Ve)&&M(i.TEXTURE_CUBE_MAP),te.__version=Z.version,x.onUpdate&&x.onUpdate(x)}A.__version=x.version}function _e(A,x,B,ee,Z,te){const me=s.convert(B.format,B.colorSpace),le=s.convert(B.type),de=T(B.internalFormat,me,le,B.colorSpace);if(!n.get(x).__hasExternalTextures){const Be=Math.max(1,x.width>>te),J=Math.max(1,x.height>>te);Z===i.TEXTURE_3D||Z===i.TEXTURE_2D_ARRAY?t.texImage3D(Z,te,de,Be,J,x.depth,0,me,le,null):t.texImage2D(Z,te,de,Be,J,0,me,le,null)}t.bindFramebuffer(i.FRAMEBUFFER,A),pe(x)?c.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,ee,Z,n.get(B).__webglTexture,0,Pe(x)):(Z===i.TEXTURE_2D||Z>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&Z<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,ee,Z,n.get(B).__webglTexture,te),t.bindFramebuffer(i.FRAMEBUFFER,null)}function De(A,x,B){if(i.bindRenderbuffer(i.RENDERBUFFER,A),x.depthBuffer&&!x.stencilBuffer){let ee=o===!0?i.DEPTH_COMPONENT24:i.DEPTH_COMPONENT16;if(B||pe(x)){const Z=x.depthTexture;Z&&Z.isDepthTexture&&(Z.type===Pn?ee=i.DEPTH_COMPONENT32F:Z.type===Cn&&(ee=i.DEPTH_COMPONENT24));const te=Pe(x);pe(x)?c.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,te,ee,x.width,x.height):i.renderbufferStorageMultisample(i.RENDERBUFFER,te,ee,x.width,x.height)}else i.renderbufferStorage(i.RENDERBUFFER,ee,x.width,x.height);i.framebufferRenderbuffer(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.RENDERBUFFER,A)}else if(x.depthBuffer&&x.stencilBuffer){const ee=Pe(x);B&&pe(x)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,ee,i.DEPTH24_STENCIL8,x.width,x.height):pe(x)?c.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,ee,i.DEPTH24_STENCIL8,x.width,x.height):i.renderbufferStorage(i.RENDERBUFFER,i.DEPTH_STENCIL,x.width,x.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.RENDERBUFFER,A)}else{const ee=x.isWebGLMultipleRenderTargets===!0?x.texture:[x.texture];for(let Z=0;Z<ee.length;Z++){const te=ee[Z],me=s.convert(te.format,te.colorSpace),le=s.convert(te.type),de=T(te.internalFormat,me,le,te.colorSpace),Ee=Pe(x);B&&pe(x)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,Ee,de,x.width,x.height):pe(x)?c.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Ee,de,x.width,x.height):i.renderbufferStorage(i.RENDERBUFFER,de,x.width,x.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Ue(A,x){if(x&&x.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(i.FRAMEBUFFER,A),!(x.depthTexture&&x.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");(!n.get(x.depthTexture).__webglTexture||x.depthTexture.image.width!==x.width||x.depthTexture.image.height!==x.height)&&(x.depthTexture.image.width=x.width,x.depthTexture.image.height=x.height,x.depthTexture.needsUpdate=!0),W(x.depthTexture,0);const ee=n.get(x.depthTexture).__webglTexture,Z=Pe(x);if(x.depthTexture.format===ei)pe(x)?c.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,ee,0,Z):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,ee,0);else if(x.depthTexture.format===ki)pe(x)?c.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,ee,0,Z):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,ee,0);else throw new Error("Unknown depthTexture format")}function Te(A){const x=n.get(A),B=A.isWebGLCubeRenderTarget===!0;if(A.depthTexture&&!x.__autoAllocateDepthBuffer){if(B)throw new Error("target.depthTexture not supported in Cube render targets");Ue(x.__webglFramebuffer,A)}else if(B){x.__webglDepthbuffer=[];for(let ee=0;ee<6;ee++)t.bindFramebuffer(i.FRAMEBUFFER,x.__webglFramebuffer[ee]),x.__webglDepthbuffer[ee]=i.createRenderbuffer(),De(x.__webglDepthbuffer[ee],A,!1)}else t.bindFramebuffer(i.FRAMEBUFFER,x.__webglFramebuffer),x.__webglDepthbuffer=i.createRenderbuffer(),De(x.__webglDepthbuffer,A,!1);t.bindFramebuffer(i.FRAMEBUFFER,null)}function qe(A,x,B){const ee=n.get(A);x!==void 0&&_e(ee.__webglFramebuffer,A,A.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),B!==void 0&&Te(A)}function O(A){const x=A.texture,B=n.get(A),ee=n.get(x);A.addEventListener("dispose",V),A.isWebGLMultipleRenderTargets!==!0&&(ee.__webglTexture===void 0&&(ee.__webglTexture=i.createTexture()),ee.__version=x.version,l.memory.textures++);const Z=A.isWebGLCubeRenderTarget===!0,te=A.isWebGLMultipleRenderTargets===!0,me=m(A)||o;if(Z){B.__webglFramebuffer=[];for(let le=0;le<6;le++)if(o&&x.mipmaps&&x.mipmaps.length>0){B.__webglFramebuffer[le]=[];for(let de=0;de<x.mipmaps.length;de++)B.__webglFramebuffer[le][de]=i.createFramebuffer()}else B.__webglFramebuffer[le]=i.createFramebuffer()}else{if(o&&x.mipmaps&&x.mipmaps.length>0){B.__webglFramebuffer=[];for(let le=0;le<x.mipmaps.length;le++)B.__webglFramebuffer[le]=i.createFramebuffer()}else B.__webglFramebuffer=i.createFramebuffer();if(te)if(r.drawBuffers){const le=A.texture;for(let de=0,Ee=le.length;de<Ee;de++){const Be=n.get(le[de]);Be.__webglTexture===void 0&&(Be.__webglTexture=i.createTexture(),l.memory.textures++)}}else console.warn("THREE.WebGLRenderer: WebGLMultipleRenderTargets can only be used with WebGL2 or WEBGL_draw_buffers extension.");if(o&&A.samples>0&&pe(A)===!1){const le=te?x:[x];B.__webglMultisampledFramebuffer=i.createFramebuffer(),B.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,B.__webglMultisampledFramebuffer);for(let de=0;de<le.length;de++){const Ee=le[de];B.__webglColorRenderbuffer[de]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,B.__webglColorRenderbuffer[de]);const Be=s.convert(Ee.format,Ee.colorSpace),J=s.convert(Ee.type),je=T(Ee.internalFormat,Be,J,Ee.colorSpace,A.isXRRenderTarget===!0),Ve=Pe(A);i.renderbufferStorageMultisample(i.RENDERBUFFER,Ve,je,A.width,A.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+de,i.RENDERBUFFER,B.__webglColorRenderbuffer[de])}i.bindRenderbuffer(i.RENDERBUFFER,null),A.depthBuffer&&(B.__webglDepthRenderbuffer=i.createRenderbuffer(),De(B.__webglDepthRenderbuffer,A,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(Z){t.bindTexture(i.TEXTURE_CUBE_MAP,ee.__webglTexture),X(i.TEXTURE_CUBE_MAP,x,me);for(let le=0;le<6;le++)if(o&&x.mipmaps&&x.mipmaps.length>0)for(let de=0;de<x.mipmaps.length;de++)_e(B.__webglFramebuffer[le][de],A,x,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+le,de);else _e(B.__webglFramebuffer[le],A,x,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+le,0);y(x,me)&&M(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(te){const le=A.texture;for(let de=0,Ee=le.length;de<Ee;de++){const Be=le[de],J=n.get(Be);t.bindTexture(i.TEXTURE_2D,J.__webglTexture),X(i.TEXTURE_2D,Be,me),_e(B.__webglFramebuffer,A,Be,i.COLOR_ATTACHMENT0+de,i.TEXTURE_2D,0),y(Be,me)&&M(i.TEXTURE_2D)}t.unbindTexture()}else{let le=i.TEXTURE_2D;if((A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&(o?le=A.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY:console.error("THREE.WebGLTextures: THREE.Data3DTexture and THREE.DataArrayTexture only supported with WebGL2.")),t.bindTexture(le,ee.__webglTexture),X(le,x,me),o&&x.mipmaps&&x.mipmaps.length>0)for(let de=0;de<x.mipmaps.length;de++)_e(B.__webglFramebuffer[de],A,x,i.COLOR_ATTACHMENT0,le,de);else _e(B.__webglFramebuffer,A,x,i.COLOR_ATTACHMENT0,le,0);y(x,me)&&M(le),t.unbindTexture()}A.depthBuffer&&Te(A)}function bt(A){const x=m(A)||o,B=A.isWebGLMultipleRenderTargets===!0?A.texture:[A.texture];for(let ee=0,Z=B.length;ee<Z;ee++){const te=B[ee];if(y(te,x)){const me=A.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:i.TEXTURE_2D,le=n.get(te).__webglTexture;t.bindTexture(me,le),M(me),t.unbindTexture()}}}function xe(A){if(o&&A.samples>0&&pe(A)===!1){const x=A.isWebGLMultipleRenderTargets?A.texture:[A.texture],B=A.width,ee=A.height;let Z=i.COLOR_BUFFER_BIT;const te=[],me=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,le=n.get(A),de=A.isWebGLMultipleRenderTargets===!0;if(de)for(let Ee=0;Ee<x.length;Ee++)t.bindFramebuffer(i.FRAMEBUFFER,le.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ee,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,le.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ee,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,le.__webglMultisampledFramebuffer),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,le.__webglFramebuffer);for(let Ee=0;Ee<x.length;Ee++){te.push(i.COLOR_ATTACHMENT0+Ee),A.depthBuffer&&te.push(me);const Be=le.__ignoreDepthValues!==void 0?le.__ignoreDepthValues:!1;if(Be===!1&&(A.depthBuffer&&(Z|=i.DEPTH_BUFFER_BIT),A.stencilBuffer&&(Z|=i.STENCIL_BUFFER_BIT)),de&&i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,le.__webglColorRenderbuffer[Ee]),Be===!0&&(i.invalidateFramebuffer(i.READ_FRAMEBUFFER,[me]),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[me])),de){const J=n.get(x[Ee]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,J,0)}i.blitFramebuffer(0,0,B,ee,0,0,B,ee,Z,i.NEAREST),h&&i.invalidateFramebuffer(i.READ_FRAMEBUFFER,te)}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),de)for(let Ee=0;Ee<x.length;Ee++){t.bindFramebuffer(i.FRAMEBUFFER,le.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ee,i.RENDERBUFFER,le.__webglColorRenderbuffer[Ee]);const Be=n.get(x[Ee]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,le.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+Ee,i.TEXTURE_2D,Be,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,le.__webglMultisampledFramebuffer)}}function Pe(A){return Math.min(r.maxSamples,A.samples)}function pe(A){const x=n.get(A);return o&&A.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&x.__useRenderToTexture!==!1}function tt(A){const x=l.render.frame;u.get(A)!==x&&(u.set(A,x),A.update())}function Fe(A,x){const B=A.colorSpace,ee=A.format,Z=A.type;return A.isCompressedTexture===!0||A.isVideoTexture===!0||A.format===wo||B!==xn&&B!==Kt&&(Ke.getTransfer(B)===et?o===!1?e.has("EXT_sRGB")===!0&&ee===sn?(A.format=wo,A.minFilter=Wt,A.generateMipmaps=!1):x=Lc.sRGBToLinear(x):(ee!==sn||Z!==Nn)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",B)),x}this.allocateTextureUnit=I,this.resetTextureUnits=Q,this.setTexture2D=W,this.setTexture2DArray=j,this.setTexture3D=q,this.setTextureCube=Y,this.rebindTextures=qe,this.setupRenderTarget=O,this.updateRenderTargetMipmap=bt,this.updateMultisampleRenderTarget=xe,this.setupDepthRenderbuffer=Te,this.setupFrameBufferTexture=_e,this.useMultisampledRTT=pe}function Ag(i,e,t){const n=t.isWebGL2;function r(s,l=Kt){let o;const c=Ke.getTransfer(l);if(s===Nn)return i.UNSIGNED_BYTE;if(s===Sc)return i.UNSIGNED_SHORT_4_4_4_4;if(s===Ec)return i.UNSIGNED_SHORT_5_5_5_1;if(s===au)return i.BYTE;if(s===lu)return i.SHORT;if(s===Fo)return i.UNSIGNED_SHORT;if(s===yc)return i.INT;if(s===Cn)return i.UNSIGNED_INT;if(s===Pn)return i.FLOAT;if(s===or)return n?i.HALF_FLOAT:(o=e.get("OES_texture_half_float"),o!==null?o.HALF_FLOAT_OES:null);if(s===cu)return i.ALPHA;if(s===sn)return i.RGBA;if(s===hu)return i.LUMINANCE;if(s===uu)return i.LUMINANCE_ALPHA;if(s===ei)return i.DEPTH_COMPONENT;if(s===ki)return i.DEPTH_STENCIL;if(s===wo)return o=e.get("EXT_sRGB"),o!==null?o.SRGB_ALPHA_EXT:null;if(s===du)return i.RED;if(s===Tc)return i.RED_INTEGER;if(s===fu)return i.RG;if(s===bc)return i.RG_INTEGER;if(s===Ac)return i.RGBA_INTEGER;if(s===Rs||s===Cs||s===Ps||s===Ls)if(c===et)if(o=e.get("WEBGL_compressed_texture_s3tc_srgb"),o!==null){if(s===Rs)return o.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(s===Cs)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(s===Ps)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(s===Ls)return o.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(o=e.get("WEBGL_compressed_texture_s3tc"),o!==null){if(s===Rs)return o.COMPRESSED_RGB_S3TC_DXT1_EXT;if(s===Cs)return o.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(s===Ps)return o.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(s===Ls)return o.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(s===ha||s===ua||s===da||s===fa)if(o=e.get("WEBGL_compressed_texture_pvrtc"),o!==null){if(s===ha)return o.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(s===ua)return o.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(s===da)return o.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(s===fa)return o.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(s===wc)return o=e.get("WEBGL_compressed_texture_etc1"),o!==null?o.COMPRESSED_RGB_ETC1_WEBGL:null;if(s===pa||s===ma)if(o=e.get("WEBGL_compressed_texture_etc"),o!==null){if(s===pa)return c===et?o.COMPRESSED_SRGB8_ETC2:o.COMPRESSED_RGB8_ETC2;if(s===ma)return c===et?o.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:o.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(s===ga||s===_a||s===va||s===Ma||s===xa||s===ya||s===Sa||s===Ea||s===Ta||s===ba||s===Aa||s===wa||s===Ra||s===Ca)if(o=e.get("WEBGL_compressed_texture_astc"),o!==null){if(s===ga)return c===et?o.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:o.COMPRESSED_RGBA_ASTC_4x4_KHR;if(s===_a)return c===et?o.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:o.COMPRESSED_RGBA_ASTC_5x4_KHR;if(s===va)return c===et?o.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:o.COMPRESSED_RGBA_ASTC_5x5_KHR;if(s===Ma)return c===et?o.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:o.COMPRESSED_RGBA_ASTC_6x5_KHR;if(s===xa)return c===et?o.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:o.COMPRESSED_RGBA_ASTC_6x6_KHR;if(s===ya)return c===et?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:o.COMPRESSED_RGBA_ASTC_8x5_KHR;if(s===Sa)return c===et?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:o.COMPRESSED_RGBA_ASTC_8x6_KHR;if(s===Ea)return c===et?o.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:o.COMPRESSED_RGBA_ASTC_8x8_KHR;if(s===Ta)return c===et?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:o.COMPRESSED_RGBA_ASTC_10x5_KHR;if(s===ba)return c===et?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:o.COMPRESSED_RGBA_ASTC_10x6_KHR;if(s===Aa)return c===et?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:o.COMPRESSED_RGBA_ASTC_10x8_KHR;if(s===wa)return c===et?o.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:o.COMPRESSED_RGBA_ASTC_10x10_KHR;if(s===Ra)return c===et?o.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:o.COMPRESSED_RGBA_ASTC_12x10_KHR;if(s===Ca)return c===et?o.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:o.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(s===Ds||s===Pa||s===La)if(o=e.get("EXT_texture_compression_bptc"),o!==null){if(s===Ds)return c===et?o.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:o.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(s===Pa)return o.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(s===La)return o.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(s===pu||s===Da||s===Ia||s===Ua)if(o=e.get("EXT_texture_compression_rgtc"),o!==null){if(s===Ds)return o.COMPRESSED_RED_RGTC1_EXT;if(s===Da)return o.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(s===Ia)return o.COMPRESSED_RED_GREEN_RGTC2_EXT;if(s===Ua)return o.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return s===Qn?n?i.UNSIGNED_INT_24_8:(o=e.get("WEBGL_depth_texture"),o!==null?o.UNSIGNED_INT_24_8_WEBGL:null):i[s]!==void 0?i[s]:null}return{convert:r}}class wg extends qt{constructor(e=[]){super(),this.isArrayCamera=!0,this.cameras=e}}class yt extends _t{constructor(){super(),this.isGroup=!0,this.type="Group"}}const Rg={type:"move"};class io{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new yt,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new yt,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new P,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new P),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new yt,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new P,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new P),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let r=null,s=null,l=null;const o=this._targetRay,c=this._grip,h=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(h&&e.hand){l=!0;for(const _ of e.hand.values()){const m=t.getJointPose(_,n),f=this._getHandJoint(h,_);m!==null&&(f.matrix.fromArray(m.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=m.radius),f.visible=m!==null}const u=h.joints["index-finger-tip"],d=h.joints["thumb-tip"],p=u.position.distanceTo(d.position),g=.02,v=.005;h.inputState.pinching&&p>g+v?(h.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!h.inputState.pinching&&p<=g-v&&(h.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else c!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,n),s!==null&&(c.matrix.fromArray(s.transform.matrix),c.matrix.decompose(c.position,c.rotation,c.scale),c.matrixWorldNeedsUpdate=!0,s.linearVelocity?(c.hasLinearVelocity=!0,c.linearVelocity.copy(s.linearVelocity)):c.hasLinearVelocity=!1,s.angularVelocity?(c.hasAngularVelocity=!0,c.angularVelocity.copy(s.angularVelocity)):c.hasAngularVelocity=!1));o!==null&&(r=t.getPose(e.targetRaySpace,n),r===null&&s!==null&&(r=s),r!==null&&(o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,r.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(r.linearVelocity)):o.hasLinearVelocity=!1,r.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(r.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Rg)))}return o!==null&&(o.visible=r!==null),c!==null&&(c.visible=s!==null),h!==null&&(h.visible=l!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const n=new yt;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}class Cg extends ai{constructor(e,t){super();const n=this;let r=null,s=1,l=null,o="local-floor",c=1,h=null,u=null,d=null,p=null,g=null,v=null;const _=t.getContextAttributes();let m=null,f=null;const y=[],M=[],T=new Re;let L=null;const R=new qt;R.layers.enable(1),R.viewport=new mt;const C=new qt;C.layers.enable(2),C.viewport=new mt;const V=[R,C],S=new wg;S.layers.enable(1),S.layers.enable(2);let b=null,z=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(X){let $=y[X];return $===void 0&&($=new io,y[X]=$),$.getTargetRaySpace()},this.getControllerGrip=function(X){let $=y[X];return $===void 0&&($=new io,y[X]=$),$.getGripSpace()},this.getHand=function(X){let $=y[X];return $===void 0&&($=new io,y[X]=$),$.getHandSpace()};function k(X){const $=M.indexOf(X.inputSource);if($===-1)return;const he=y[$];he!==void 0&&(he.update(X.inputSource,X.frame,h||l),he.dispatchEvent({type:X.type,data:X.inputSource}))}function Q(){r.removeEventListener("select",k),r.removeEventListener("selectstart",k),r.removeEventListener("selectend",k),r.removeEventListener("squeeze",k),r.removeEventListener("squeezestart",k),r.removeEventListener("squeezeend",k),r.removeEventListener("end",Q),r.removeEventListener("inputsourceschange",I);for(let X=0;X<y.length;X++){const $=M[X];$!==null&&(M[X]=null,y[X].disconnect($))}b=null,z=null,e.setRenderTarget(m),g=null,p=null,d=null,r=null,f=null,ie.stop(),n.isPresenting=!1,e.setPixelRatio(L),e.setSize(T.width,T.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(X){s=X,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(X){o=X,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return h||l},this.setReferenceSpace=function(X){h=X},this.getBaseLayer=function(){return p!==null?p:g},this.getBinding=function(){return d},this.getFrame=function(){return v},this.getSession=function(){return r},this.setSession=async function(X){if(r=X,r!==null){if(m=e.getRenderTarget(),r.addEventListener("select",k),r.addEventListener("selectstart",k),r.addEventListener("selectend",k),r.addEventListener("squeeze",k),r.addEventListener("squeezestart",k),r.addEventListener("squeezeend",k),r.addEventListener("end",Q),r.addEventListener("inputsourceschange",I),_.xrCompatible!==!0&&await t.makeXRCompatible(),L=e.getPixelRatio(),e.getSize(T),r.renderState.layers===void 0||e.capabilities.isWebGL2===!1){const $={antialias:r.renderState.layers===void 0?_.antialias:!0,alpha:!0,depth:_.depth,stencil:_.stencil,framebufferScaleFactor:s};g=new XRWebGLLayer(r,t,$),r.updateRenderState({baseLayer:g}),e.setPixelRatio(1),e.setSize(g.framebufferWidth,g.framebufferHeight,!1),f=new ii(g.framebufferWidth,g.framebufferHeight,{format:sn,type:Nn,colorSpace:e.outputColorSpace,stencilBuffer:_.stencil})}else{let $=null,he=null,ve=null;_.depth&&(ve=_.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,$=_.stencil?ki:ei,he=_.stencil?Qn:Cn);const _e={colorFormat:t.RGBA8,depthFormat:ve,scaleFactor:s};d=new XRWebGLBinding(r,t),p=d.createProjectionLayer(_e),r.updateRenderState({layers:[p]}),e.setPixelRatio(1),e.setSize(p.textureWidth,p.textureHeight,!1),f=new ii(p.textureWidth,p.textureHeight,{format:sn,type:Nn,depthTexture:new Vc(p.textureWidth,p.textureHeight,he,void 0,void 0,void 0,void 0,void 0,void 0,$),stencilBuffer:_.stencil,colorSpace:e.outputColorSpace,samples:_.antialias?4:0});const De=e.properties.get(f);De.__ignoreDepthValues=p.ignoreDepthValues}f.isXRRenderTarget=!0,this.setFoveation(c),h=null,l=await r.requestReferenceSpace(o),ie.setContext(r),ie.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode};function I(X){for(let $=0;$<X.removed.length;$++){const he=X.removed[$],ve=M.indexOf(he);ve>=0&&(M[ve]=null,y[ve].disconnect(he))}for(let $=0;$<X.added.length;$++){const he=X.added[$];let ve=M.indexOf(he);if(ve===-1){for(let De=0;De<y.length;De++)if(De>=M.length){M.push(he),ve=De;break}else if(M[De]===null){M[De]=he,ve=De;break}if(ve===-1)break}const _e=y[ve];_e&&_e.connect(he)}}const N=new P,W=new P;function j(X,$,he){N.setFromMatrixPosition($.matrixWorld),W.setFromMatrixPosition(he.matrixWorld);const ve=N.distanceTo(W),_e=$.projectionMatrix.elements,De=he.projectionMatrix.elements,Ue=_e[14]/(_e[10]-1),Te=_e[14]/(_e[10]+1),qe=(_e[9]+1)/_e[5],O=(_e[9]-1)/_e[5],bt=(_e[8]-1)/_e[0],xe=(De[8]+1)/De[0],Pe=Ue*bt,pe=Ue*xe,tt=ve/(-bt+xe),Fe=tt*-bt;$.matrixWorld.decompose(X.position,X.quaternion,X.scale),X.translateX(Fe),X.translateZ(tt),X.matrixWorld.compose(X.position,X.quaternion,X.scale),X.matrixWorldInverse.copy(X.matrixWorld).invert();const A=Ue+tt,x=Te+tt,B=Pe-Fe,ee=pe+(ve-Fe),Z=qe*Te/x*A,te=O*Te/x*A;X.projectionMatrix.makePerspective(B,ee,Z,te,A,x),X.projectionMatrixInverse.copy(X.projectionMatrix).invert()}function q(X,$){$===null?X.matrixWorld.copy(X.matrix):X.matrixWorld.multiplyMatrices($.matrixWorld,X.matrix),X.matrixWorldInverse.copy(X.matrixWorld).invert()}this.updateCamera=function(X){if(r===null)return;S.near=C.near=R.near=X.near,S.far=C.far=R.far=X.far,(b!==S.near||z!==S.far)&&(r.updateRenderState({depthNear:S.near,depthFar:S.far}),b=S.near,z=S.far);const $=X.parent,he=S.cameras;q(S,$);for(let ve=0;ve<he.length;ve++)q(he[ve],$);he.length===2?j(S,R,C):S.projectionMatrix.copy(R.projectionMatrix),Y(X,S,$)};function Y(X,$,he){he===null?X.matrix.copy($.matrixWorld):(X.matrix.copy(he.matrixWorld),X.matrix.invert(),X.matrix.multiply($.matrixWorld)),X.matrix.decompose(X.position,X.quaternion,X.scale),X.updateMatrixWorld(!0),X.projectionMatrix.copy($.projectionMatrix),X.projectionMatrixInverse.copy($.projectionMatrixInverse),X.isPerspectiveCamera&&(X.fov=Ro*2*Math.atan(1/X.projectionMatrix.elements[5]),X.zoom=1)}this.getCamera=function(){return S},this.getFoveation=function(){if(!(p===null&&g===null))return c},this.setFoveation=function(X){c=X,p!==null&&(p.fixedFoveation=X),g!==null&&g.fixedFoveation!==void 0&&(g.fixedFoveation=X)};let K=null;function ne(X,$){if(u=$.getViewerPose(h||l),v=$,u!==null){const he=u.views;g!==null&&(e.setRenderTargetFramebuffer(f,g.framebuffer),e.setRenderTarget(f));let ve=!1;he.length!==S.cameras.length&&(S.cameras.length=0,ve=!0);for(let _e=0;_e<he.length;_e++){const De=he[_e];let Ue=null;if(g!==null)Ue=g.getViewport(De);else{const qe=d.getViewSubImage(p,De);Ue=qe.viewport,_e===0&&(e.setRenderTargetTextures(f,qe.colorTexture,p.ignoreDepthValues?void 0:qe.depthStencilTexture),e.setRenderTarget(f))}let Te=V[_e];Te===void 0&&(Te=new qt,Te.layers.enable(_e),Te.viewport=new mt,V[_e]=Te),Te.matrix.fromArray(De.transform.matrix),Te.matrix.decompose(Te.position,Te.quaternion,Te.scale),Te.projectionMatrix.fromArray(De.projectionMatrix),Te.projectionMatrixInverse.copy(Te.projectionMatrix).invert(),Te.viewport.set(Ue.x,Ue.y,Ue.width,Ue.height),_e===0&&(S.matrix.copy(Te.matrix),S.matrix.decompose(S.position,S.quaternion,S.scale)),ve===!0&&S.cameras.push(Te)}}for(let he=0;he<y.length;he++){const ve=M[he],_e=y[he];ve!==null&&_e!==void 0&&_e.update(ve,$,h||l)}K&&K(X,$),$.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:$}),v=null}const ie=new kc;ie.setAnimationLoop(ne),this.setAnimationLoop=function(X){K=X},this.dispose=function(){}}}function Pg(i,e){function t(m,f){m.matrixAutoUpdate===!0&&m.updateMatrix(),f.value.copy(m.matrix)}function n(m,f){f.color.getRGB(m.fogColor.value,Bc(i)),f.isFog?(m.fogNear.value=f.near,m.fogFar.value=f.far):f.isFogExp2&&(m.fogDensity.value=f.density)}function r(m,f,y,M,T){f.isMeshBasicMaterial||f.isMeshLambertMaterial?s(m,f):f.isMeshToonMaterial?(s(m,f),d(m,f)):f.isMeshPhongMaterial?(s(m,f),u(m,f)):f.isMeshStandardMaterial?(s(m,f),p(m,f),f.isMeshPhysicalMaterial&&g(m,f,T)):f.isMeshMatcapMaterial?(s(m,f),v(m,f)):f.isMeshDepthMaterial?s(m,f):f.isMeshDistanceMaterial?(s(m,f),_(m,f)):f.isMeshNormalMaterial?s(m,f):f.isLineBasicMaterial?(l(m,f),f.isLineDashedMaterial&&o(m,f)):f.isPointsMaterial?c(m,f,y,M):f.isSpriteMaterial?h(m,f):f.isShadowMaterial?(m.color.value.copy(f.color),m.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function s(m,f){m.opacity.value=f.opacity,f.color&&m.diffuse.value.copy(f.color),f.emissive&&m.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(m.map.value=f.map,t(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,t(f.alphaMap,m.alphaMapTransform)),f.bumpMap&&(m.bumpMap.value=f.bumpMap,t(f.bumpMap,m.bumpMapTransform),m.bumpScale.value=f.bumpScale,f.side===Ut&&(m.bumpScale.value*=-1)),f.normalMap&&(m.normalMap.value=f.normalMap,t(f.normalMap,m.normalMapTransform),m.normalScale.value.copy(f.normalScale),f.side===Ut&&m.normalScale.value.negate()),f.displacementMap&&(m.displacementMap.value=f.displacementMap,t(f.displacementMap,m.displacementMapTransform),m.displacementScale.value=f.displacementScale,m.displacementBias.value=f.displacementBias),f.emissiveMap&&(m.emissiveMap.value=f.emissiveMap,t(f.emissiveMap,m.emissiveMapTransform)),f.specularMap&&(m.specularMap.value=f.specularMap,t(f.specularMap,m.specularMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest);const y=e.get(f).envMap;if(y&&(m.envMap.value=y,m.flipEnvMap.value=y.isCubeTexture&&y.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=f.reflectivity,m.ior.value=f.ior,m.refractionRatio.value=f.refractionRatio),f.lightMap){m.lightMap.value=f.lightMap;const M=i._useLegacyLights===!0?Math.PI:1;m.lightMapIntensity.value=f.lightMapIntensity*M,t(f.lightMap,m.lightMapTransform)}f.aoMap&&(m.aoMap.value=f.aoMap,m.aoMapIntensity.value=f.aoMapIntensity,t(f.aoMap,m.aoMapTransform))}function l(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,f.map&&(m.map.value=f.map,t(f.map,m.mapTransform))}function o(m,f){m.dashSize.value=f.dashSize,m.totalSize.value=f.dashSize+f.gapSize,m.scale.value=f.scale}function c(m,f,y,M){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.size.value=f.size*y,m.scale.value=M*.5,f.map&&(m.map.value=f.map,t(f.map,m.uvTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,t(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function h(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.rotation.value=f.rotation,f.map&&(m.map.value=f.map,t(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,t(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function u(m,f){m.specular.value.copy(f.specular),m.shininess.value=Math.max(f.shininess,1e-4)}function d(m,f){f.gradientMap&&(m.gradientMap.value=f.gradientMap)}function p(m,f){m.metalness.value=f.metalness,f.metalnessMap&&(m.metalnessMap.value=f.metalnessMap,t(f.metalnessMap,m.metalnessMapTransform)),m.roughness.value=f.roughness,f.roughnessMap&&(m.roughnessMap.value=f.roughnessMap,t(f.roughnessMap,m.roughnessMapTransform)),e.get(f).envMap&&(m.envMapIntensity.value=f.envMapIntensity)}function g(m,f,y){m.ior.value=f.ior,f.sheen>0&&(m.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),m.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(m.sheenColorMap.value=f.sheenColorMap,t(f.sheenColorMap,m.sheenColorMapTransform)),f.sheenRoughnessMap&&(m.sheenRoughnessMap.value=f.sheenRoughnessMap,t(f.sheenRoughnessMap,m.sheenRoughnessMapTransform))),f.clearcoat>0&&(m.clearcoat.value=f.clearcoat,m.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(m.clearcoatMap.value=f.clearcoatMap,t(f.clearcoatMap,m.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,t(f.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(m.clearcoatNormalMap.value=f.clearcoatNormalMap,t(f.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===Ut&&m.clearcoatNormalScale.value.negate())),f.iridescence>0&&(m.iridescence.value=f.iridescence,m.iridescenceIOR.value=f.iridescenceIOR,m.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(m.iridescenceMap.value=f.iridescenceMap,t(f.iridescenceMap,m.iridescenceMapTransform)),f.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=f.iridescenceThicknessMap,t(f.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),f.transmission>0&&(m.transmission.value=f.transmission,m.transmissionSamplerMap.value=y.texture,m.transmissionSamplerSize.value.set(y.width,y.height),f.transmissionMap&&(m.transmissionMap.value=f.transmissionMap,t(f.transmissionMap,m.transmissionMapTransform)),m.thickness.value=f.thickness,f.thicknessMap&&(m.thicknessMap.value=f.thicknessMap,t(f.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=f.attenuationDistance,m.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(m.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(m.anisotropyMap.value=f.anisotropyMap,t(f.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=f.specularIntensity,m.specularColor.value.copy(f.specularColor),f.specularColorMap&&(m.specularColorMap.value=f.specularColorMap,t(f.specularColorMap,m.specularColorMapTransform)),f.specularIntensityMap&&(m.specularIntensityMap.value=f.specularIntensityMap,t(f.specularIntensityMap,m.specularIntensityMapTransform))}function v(m,f){f.matcap&&(m.matcap.value=f.matcap)}function _(m,f){const y=e.get(f).light;m.referencePosition.value.setFromMatrixPosition(y.matrixWorld),m.nearDistance.value=y.shadow.camera.near,m.farDistance.value=y.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:r}}function Lg(i,e,t,n){let r={},s={},l=[];const o=t.isWebGL2?i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS):0;function c(y,M){const T=M.program;n.uniformBlockBinding(y,T)}function h(y,M){let T=r[y.id];T===void 0&&(v(y),T=u(y),r[y.id]=T,y.addEventListener("dispose",m));const L=M.program;n.updateUBOMapping(y,L);const R=e.render.frame;s[y.id]!==R&&(p(y),s[y.id]=R)}function u(y){const M=d();y.__bindingPointIndex=M;const T=i.createBuffer(),L=y.__size,R=y.usage;return i.bindBuffer(i.UNIFORM_BUFFER,T),i.bufferData(i.UNIFORM_BUFFER,L,R),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,M,T),T}function d(){for(let y=0;y<o;y++)if(l.indexOf(y)===-1)return l.push(y),y;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function p(y){const M=r[y.id],T=y.uniforms,L=y.__cache;i.bindBuffer(i.UNIFORM_BUFFER,M);for(let R=0,C=T.length;R<C;R++){const V=Array.isArray(T[R])?T[R]:[T[R]];for(let S=0,b=V.length;S<b;S++){const z=V[S];if(g(z,R,S,L)===!0){const k=z.__offset,Q=Array.isArray(z.value)?z.value:[z.value];let I=0;for(let N=0;N<Q.length;N++){const W=Q[N],j=_(W);typeof W=="number"||typeof W=="boolean"?(z.__data[0]=W,i.bufferSubData(i.UNIFORM_BUFFER,k+I,z.__data)):W.isMatrix3?(z.__data[0]=W.elements[0],z.__data[1]=W.elements[1],z.__data[2]=W.elements[2],z.__data[3]=0,z.__data[4]=W.elements[3],z.__data[5]=W.elements[4],z.__data[6]=W.elements[5],z.__data[7]=0,z.__data[8]=W.elements[6],z.__data[9]=W.elements[7],z.__data[10]=W.elements[8],z.__data[11]=0):(W.toArray(z.__data,I),I+=j.storage/Float32Array.BYTES_PER_ELEMENT)}i.bufferSubData(i.UNIFORM_BUFFER,k,z.__data)}}}i.bindBuffer(i.UNIFORM_BUFFER,null)}function g(y,M,T,L){const R=y.value,C=M+"_"+T;if(L[C]===void 0)return typeof R=="number"||typeof R=="boolean"?L[C]=R:L[C]=R.clone(),!0;{const V=L[C];if(typeof R=="number"||typeof R=="boolean"){if(V!==R)return L[C]=R,!0}else if(V.equals(R)===!1)return V.copy(R),!0}return!1}function v(y){const M=y.uniforms;let T=0;const L=16;for(let C=0,V=M.length;C<V;C++){const S=Array.isArray(M[C])?M[C]:[M[C]];for(let b=0,z=S.length;b<z;b++){const k=S[b],Q=Array.isArray(k.value)?k.value:[k.value];for(let I=0,N=Q.length;I<N;I++){const W=Q[I],j=_(W),q=T%L;q!==0&&L-q<j.boundary&&(T+=L-q),k.__data=new Float32Array(j.storage/Float32Array.BYTES_PER_ELEMENT),k.__offset=T,T+=j.storage}}}const R=T%L;return R>0&&(T+=L-R),y.__size=T,y.__cache={},this}function _(y){const M={boundary:0,storage:0};return typeof y=="number"||typeof y=="boolean"?(M.boundary=4,M.storage=4):y.isVector2?(M.boundary=8,M.storage=8):y.isVector3||y.isColor?(M.boundary=16,M.storage=12):y.isVector4?(M.boundary=16,M.storage=16):y.isMatrix3?(M.boundary=48,M.storage=48):y.isMatrix4?(M.boundary=64,M.storage=64):y.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",y),M}function m(y){const M=y.target;M.removeEventListener("dispose",m);const T=l.indexOf(M.__bindingPointIndex);l.splice(T,1),i.deleteBuffer(r[M.id]),delete r[M.id],delete s[M.id]}function f(){for(const y in r)i.deleteBuffer(r[y]);l=[],r={},s={}}return{bind:c,update:h,dispose:f}}class Kc{constructor(e={}){const{canvas:t=Au(),context:n=null,depth:r=!0,stencil:s=!0,alpha:l=!1,antialias:o=!1,premultipliedAlpha:c=!0,preserveDrawingBuffer:h=!1,powerPreference:u="default",failIfMajorPerformanceCaveat:d=!1}=e;this.isWebGLRenderer=!0;let p;n!==null?p=n.getContextAttributes().alpha:p=l;const g=new Uint32Array(4),v=new Int32Array(4);let _=null,m=null;const f=[],y=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=Mt,this._useLegacyLights=!1,this.toneMapping=Un,this.toneMappingExposure=1;const M=this;let T=!1,L=0,R=0,C=null,V=-1,S=null;const b=new mt,z=new mt;let k=null;const Q=new We(0);let I=0,N=t.width,W=t.height,j=1,q=null,Y=null;const K=new mt(0,0,N,W),ne=new mt(0,0,N,W);let ie=!1;const X=new ko;let $=!1,he=!1,ve=null;const _e=new it,De=new Re,Ue=new P,Te={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};function qe(){return C===null?j:1}let O=n;function bt(E,U){for(let G=0;G<E.length;G++){const H=E[G],F=t.getContext(H,U);if(F!==null)return F}return null}try{const E={alpha:!0,depth:r,stencil:s,antialias:o,premultipliedAlpha:c,preserveDrawingBuffer:h,powerPreference:u,failIfMajorPerformanceCaveat:d};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${No}`),t.addEventListener("webglcontextlost",re,!1),t.addEventListener("webglcontextrestored",D,!1),t.addEventListener("webglcontextcreationerror",oe,!1),O===null){const U=["webgl2","webgl","experimental-webgl"];if(M.isWebGL1Renderer===!0&&U.shift(),O=bt(U,E),O===null)throw bt(U)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}typeof WebGLRenderingContext<"u"&&O instanceof WebGLRenderingContext&&console.warn("THREE.WebGLRenderer: WebGL 1 support was deprecated in r153 and will be removed in r163."),O.getShaderPrecisionFormat===void 0&&(O.getShaderPrecisionFormat=function(){return{rangeMin:1,rangeMax:1,precision:1}})}catch(E){throw console.error("THREE.WebGLRenderer: "+E.message),E}let xe,Pe,pe,tt,Fe,A,x,B,ee,Z,te,me,le,de,Ee,Be,J,je,Ve,Ce,Me,fe,Ne,Ye;function rt(){xe=new kp(O),Pe=new Np(O,xe,e),xe.init(Pe),fe=new Ag(O,xe,Pe),pe=new Tg(O,xe,Pe),tt=new Wp(O),Fe=new hg,A=new bg(O,xe,pe,Fe,Pe,fe,tt),x=new Fp(M),B=new zp(M),ee=new Ju(O,Pe),Ne=new Ip(O,xe,ee,Pe),Z=new Hp(O,ee,tt,Ne),te=new jp(O,Z,ee,tt),Ve=new Yp(O,Pe,A),Be=new Op(Fe),me=new cg(M,x,B,xe,Pe,Ne,Be),le=new Pg(M,Fe),de=new dg,Ee=new vg(xe,Pe),je=new Dp(M,x,B,pe,te,p,c),J=new Eg(M,te,Pe),Ye=new Lg(O,tt,Pe,pe),Ce=new Up(O,xe,tt,Pe),Me=new Vp(O,xe,tt,Pe),tt.programs=me.programs,M.capabilities=Pe,M.extensions=xe,M.properties=Fe,M.renderLists=de,M.shadowMap=J,M.state=pe,M.info=tt}rt();const ze=new Cg(M,O);this.xr=ze,this.getContext=function(){return O},this.getContextAttributes=function(){return O.getContextAttributes()},this.forceContextLoss=function(){const E=xe.get("WEBGL_lose_context");E&&E.loseContext()},this.forceContextRestore=function(){const E=xe.get("WEBGL_lose_context");E&&E.restoreContext()},this.getPixelRatio=function(){return j},this.setPixelRatio=function(E){E!==void 0&&(j=E,this.setSize(N,W,!1))},this.getSize=function(E){return E.set(N,W)},this.setSize=function(E,U,G=!0){if(ze.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}N=E,W=U,t.width=Math.floor(E*j),t.height=Math.floor(U*j),G===!0&&(t.style.width=E+"px",t.style.height=U+"px"),this.setViewport(0,0,E,U)},this.getDrawingBufferSize=function(E){return E.set(N*j,W*j).floor()},this.setDrawingBufferSize=function(E,U,G){N=E,W=U,j=G,t.width=Math.floor(E*G),t.height=Math.floor(U*G),this.setViewport(0,0,E,U)},this.getCurrentViewport=function(E){return E.copy(b)},this.getViewport=function(E){return E.copy(K)},this.setViewport=function(E,U,G,H){E.isVector4?K.set(E.x,E.y,E.z,E.w):K.set(E,U,G,H),pe.viewport(b.copy(K).multiplyScalar(j).floor())},this.getScissor=function(E){return E.copy(ne)},this.setScissor=function(E,U,G,H){E.isVector4?ne.set(E.x,E.y,E.z,E.w):ne.set(E,U,G,H),pe.scissor(z.copy(ne).multiplyScalar(j).floor())},this.getScissorTest=function(){return ie},this.setScissorTest=function(E){pe.setScissorTest(ie=E)},this.setOpaqueSort=function(E){q=E},this.setTransparentSort=function(E){Y=E},this.getClearColor=function(E){return E.copy(je.getClearColor())},this.setClearColor=function(){je.setClearColor.apply(je,arguments)},this.getClearAlpha=function(){return je.getClearAlpha()},this.setClearAlpha=function(){je.setClearAlpha.apply(je,arguments)},this.clear=function(E=!0,U=!0,G=!0){let H=0;if(E){let F=!1;if(C!==null){const ue=C.texture.format;F=ue===Ac||ue===bc||ue===Tc}if(F){const ue=C.texture.type,ge=ue===Nn||ue===Cn||ue===Fo||ue===Qn||ue===Sc||ue===Ec,Se=je.getClearColor(),Ae=je.getClearAlpha(),Ge=Se.r,Le=Se.g,Ie=Se.b;ge?(g[0]=Ge,g[1]=Le,g[2]=Ie,g[3]=Ae,O.clearBufferuiv(O.COLOR,0,g)):(v[0]=Ge,v[1]=Le,v[2]=Ie,v[3]=Ae,O.clearBufferiv(O.COLOR,0,v))}else H|=O.COLOR_BUFFER_BIT}U&&(H|=O.DEPTH_BUFFER_BIT),G&&(H|=O.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),O.clear(H)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",re,!1),t.removeEventListener("webglcontextrestored",D,!1),t.removeEventListener("webglcontextcreationerror",oe,!1),de.dispose(),Ee.dispose(),Fe.dispose(),x.dispose(),B.dispose(),te.dispose(),Ne.dispose(),Ye.dispose(),me.dispose(),ze.dispose(),ze.removeEventListener("sessionstart",At),ze.removeEventListener("sessionend",Qe),ve&&(ve.dispose(),ve=null),wt.stop()};function re(E){E.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),T=!0}function D(){console.log("THREE.WebGLRenderer: Context Restored."),T=!1;const E=tt.autoReset,U=J.enabled,G=J.autoUpdate,H=J.needsUpdate,F=J.type;rt(),tt.autoReset=E,J.enabled=U,J.autoUpdate=G,J.needsUpdate=H,J.type=F}function oe(E){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",E.statusMessage)}function ae(E){const U=E.target;U.removeEventListener("dispose",ae),be(U)}function be(E){ye(E),Fe.remove(E)}function ye(E){const U=Fe.get(E).programs;U!==void 0&&(U.forEach(function(G){me.releaseProgram(G)}),E.isShaderMaterial&&me.releaseShaderCache(E))}this.renderBufferDirect=function(E,U,G,H,F,ue){U===null&&(U=Te);const ge=F.isMesh&&F.matrixWorld.determinant()<0,Se=Eh(E,U,G,H,F);pe.setMaterial(H,ge);let Ae=G.index,Ge=1;if(H.wireframe===!0){if(Ae=Z.getWireframeAttribute(G),Ae===void 0)return;Ge=2}const Le=G.drawRange,Ie=G.attributes.position;let at=Le.start*Ge,Ot=(Le.start+Le.count)*Ge;ue!==null&&(at=Math.max(at,ue.start*Ge),Ot=Math.min(Ot,(ue.start+ue.count)*Ge)),Ae!==null?(at=Math.max(at,0),Ot=Math.min(Ot,Ae.count)):Ie!=null&&(at=Math.max(at,0),Ot=Math.min(Ot,Ie.count));const ft=Ot-at;if(ft<0||ft===1/0)return;Ne.setup(F,H,Se,G,Ae);let hn,nt=Ce;if(Ae!==null&&(hn=ee.get(Ae),nt=Me,nt.setIndex(hn)),F.isMesh)H.wireframe===!0?(pe.setLineWidth(H.wireframeLinewidth*qe()),nt.setMode(O.LINES)):nt.setMode(O.TRIANGLES);else if(F.isLine){let ke=H.linewidth;ke===void 0&&(ke=1),pe.setLineWidth(ke*qe()),F.isLineSegments?nt.setMode(O.LINES):F.isLineLoop?nt.setMode(O.LINE_LOOP):nt.setMode(O.LINE_STRIP)}else F.isPoints?nt.setMode(O.POINTS):F.isSprite&&nt.setMode(O.TRIANGLES);if(F.isBatchedMesh)nt.renderMultiDraw(F._multiDrawStarts,F._multiDrawCounts,F._multiDrawCount);else if(F.isInstancedMesh)nt.renderInstances(at,ft,F.count);else if(G.isInstancedBufferGeometry){const ke=G._maxInstanceCount!==void 0?G._maxInstanceCount:1/0,Es=Math.min(G.instanceCount,ke);nt.renderInstances(at,ft,Es)}else nt.render(at,ft)};function Je(E,U,G){E.transparent===!0&&E.side===It&&E.forceSinglePass===!1?(E.side=Ut,E.needsUpdate=!0,mr(E,U,G),E.side=Fn,E.needsUpdate=!0,mr(E,U,G),E.side=It):mr(E,U,G)}this.compile=function(E,U,G=null){G===null&&(G=E),m=Ee.get(G),m.init(),y.push(m),G.traverseVisible(function(F){F.isLight&&F.layers.test(U.layers)&&(m.pushLight(F),F.castShadow&&m.pushShadow(F))}),E!==G&&E.traverseVisible(function(F){F.isLight&&F.layers.test(U.layers)&&(m.pushLight(F),F.castShadow&&m.pushShadow(F))}),m.setupLights(M._useLegacyLights);const H=new Set;return E.traverse(function(F){const ue=F.material;if(ue)if(Array.isArray(ue))for(let ge=0;ge<ue.length;ge++){const Se=ue[ge];Je(Se,G,F),H.add(Se)}else Je(ue,G,F),H.add(ue)}),y.pop(),m=null,H},this.compileAsync=function(E,U,G=null){const H=this.compile(E,U,G);return new Promise(F=>{function ue(){if(H.forEach(function(ge){Fe.get(ge).currentProgram.isReady()&&H.delete(ge)}),H.size===0){F(E);return}setTimeout(ue,10)}xe.get("KHR_parallel_shader_compile")!==null?ue():setTimeout(ue,10)})};let Ze=null;function dt(E){Ze&&Ze(E)}function At(){wt.stop()}function Qe(){wt.start()}const wt=new kc;wt.setAnimationLoop(dt),typeof self<"u"&&wt.setContext(self),this.setAnimationLoop=function(E){Ze=E,ze.setAnimationLoop(E),E===null?wt.stop():wt.start()},ze.addEventListener("sessionstart",At),ze.addEventListener("sessionend",Qe),this.render=function(E,U){if(U!==void 0&&U.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(T===!0)return;E.matrixWorldAutoUpdate===!0&&E.updateMatrixWorld(),U.parent===null&&U.matrixWorldAutoUpdate===!0&&U.updateMatrixWorld(),ze.enabled===!0&&ze.isPresenting===!0&&(ze.cameraAutoUpdate===!0&&ze.updateCamera(U),U=ze.getCamera()),E.isScene===!0&&E.onBeforeRender(M,E,U,C),m=Ee.get(E,y.length),m.init(),y.push(m),_e.multiplyMatrices(U.projectionMatrix,U.matrixWorldInverse),X.setFromProjectionMatrix(_e),he=this.localClippingEnabled,$=Be.init(this.clippingPlanes,he),_=de.get(E,f.length),_.init(),f.push(_),ln(E,U,0,M.sortObjects),_.finish(),M.sortObjects===!0&&_.sort(q,Y),this.info.render.frame++,$===!0&&Be.beginShadows();const G=m.state.shadowsArray;if(J.render(G,E,U),$===!0&&Be.endShadows(),this.info.autoReset===!0&&this.info.reset(),je.render(_,E),m.setupLights(M._useLegacyLights),U.isArrayCamera){const H=U.cameras;for(let F=0,ue=H.length;F<ue;F++){const ge=H[F];Jo(_,E,ge,ge.viewport)}}else Jo(_,E,U);C!==null&&(A.updateMultisampleRenderTarget(C),A.updateRenderTargetMipmap(C)),E.isScene===!0&&E.onAfterRender(M,E,U),Ne.resetDefaultState(),V=-1,S=null,y.pop(),y.length>0?m=y[y.length-1]:m=null,f.pop(),f.length>0?_=f[f.length-1]:_=null};function ln(E,U,G,H){if(E.visible===!1)return;if(E.layers.test(U.layers)){if(E.isGroup)G=E.renderOrder;else if(E.isLOD)E.autoUpdate===!0&&E.update(U);else if(E.isLight)m.pushLight(E),E.castShadow&&m.pushShadow(E);else if(E.isSprite){if(!E.frustumCulled||X.intersectsSprite(E)){H&&Ue.setFromMatrixPosition(E.matrixWorld).applyMatrix4(_e);const ge=te.update(E),Se=E.material;Se.visible&&_.push(E,ge,Se,G,Ue.z,null)}}else if((E.isMesh||E.isLine||E.isPoints)&&(!E.frustumCulled||X.intersectsObject(E))){const ge=te.update(E),Se=E.material;if(H&&(E.boundingSphere!==void 0?(E.boundingSphere===null&&E.computeBoundingSphere(),Ue.copy(E.boundingSphere.center)):(ge.boundingSphere===null&&ge.computeBoundingSphere(),Ue.copy(ge.boundingSphere.center)),Ue.applyMatrix4(E.matrixWorld).applyMatrix4(_e)),Array.isArray(Se)){const Ae=ge.groups;for(let Ge=0,Le=Ae.length;Ge<Le;Ge++){const Ie=Ae[Ge],at=Se[Ie.materialIndex];at&&at.visible&&_.push(E,ge,at,G,Ue.z,Ie)}}else Se.visible&&_.push(E,ge,Se,G,Ue.z,null)}}const ue=E.children;for(let ge=0,Se=ue.length;ge<Se;ge++)ln(ue[ge],U,G,H)}function Jo(E,U,G,H){const F=E.opaque,ue=E.transmissive,ge=E.transparent;m.setupLightsView(G),$===!0&&Be.setGlobalState(M.clippingPlanes,G),ue.length>0&&Sh(F,ue,U,G),H&&pe.viewport(b.copy(H)),F.length>0&&pr(F,U,G),ue.length>0&&pr(ue,U,G),ge.length>0&&pr(ge,U,G),pe.buffers.depth.setTest(!0),pe.buffers.depth.setMask(!0),pe.buffers.color.setMask(!0),pe.setPolygonOffset(!1)}function Sh(E,U,G,H){if((G.isScene===!0?G.overrideMaterial:null)!==null)return;const ue=Pe.isWebGL2;ve===null&&(ve=new ii(1,1,{generateMipmaps:!0,type:xe.has("EXT_color_buffer_half_float")?or:Nn,minFilter:sr,samples:ue?4:0})),M.getDrawingBufferSize(De),ue?ve.setSize(De.x,De.y):ve.setSize(Co(De.x),Co(De.y));const ge=M.getRenderTarget();M.setRenderTarget(ve),M.getClearColor(Q),I=M.getClearAlpha(),I<1&&M.setClearColor(16777215,.5),M.clear();const Se=M.toneMapping;M.toneMapping=Un,pr(E,G,H),A.updateMultisampleRenderTarget(ve),A.updateRenderTargetMipmap(ve);let Ae=!1;for(let Ge=0,Le=U.length;Ge<Le;Ge++){const Ie=U[Ge],at=Ie.object,Ot=Ie.geometry,ft=Ie.material,hn=Ie.group;if(ft.side===It&&at.layers.test(H.layers)){const nt=ft.side;ft.side=Ut,ft.needsUpdate=!0,Zo(at,G,H,Ot,ft,hn),ft.side=nt,ft.needsUpdate=!0,Ae=!0}}Ae===!0&&(A.updateMultisampleRenderTarget(ve),A.updateRenderTargetMipmap(ve)),M.setRenderTarget(ge),M.setClearColor(Q,I),M.toneMapping=Se}function pr(E,U,G){const H=U.isScene===!0?U.overrideMaterial:null;for(let F=0,ue=E.length;F<ue;F++){const ge=E[F],Se=ge.object,Ae=ge.geometry,Ge=H===null?ge.material:H,Le=ge.group;Se.layers.test(G.layers)&&Zo(Se,U,G,Ae,Ge,Le)}}function Zo(E,U,G,H,F,ue){E.onBeforeRender(M,U,G,H,F,ue),E.modelViewMatrix.multiplyMatrices(G.matrixWorldInverse,E.matrixWorld),E.normalMatrix.getNormalMatrix(E.modelViewMatrix),F.onBeforeRender(M,U,G,H,E,ue),F.transparent===!0&&F.side===It&&F.forceSinglePass===!1?(F.side=Ut,F.needsUpdate=!0,M.renderBufferDirect(G,U,H,F,E,ue),F.side=Fn,F.needsUpdate=!0,M.renderBufferDirect(G,U,H,F,E,ue),F.side=It):M.renderBufferDirect(G,U,H,F,E,ue),E.onAfterRender(M,U,G,H,F,ue)}function mr(E,U,G){U.isScene!==!0&&(U=Te);const H=Fe.get(E),F=m.state.lights,ue=m.state.shadowsArray,ge=F.state.version,Se=me.getParameters(E,F.state,ue,U,G),Ae=me.getProgramCacheKey(Se);let Ge=H.programs;H.environment=E.isMeshStandardMaterial?U.environment:null,H.fog=U.fog,H.envMap=(E.isMeshStandardMaterial?B:x).get(E.envMap||H.environment),Ge===void 0&&(E.addEventListener("dispose",ae),Ge=new Map,H.programs=Ge);let Le=Ge.get(Ae);if(Le!==void 0){if(H.currentProgram===Le&&H.lightsStateVersion===ge)return ea(E,Se),Le}else Se.uniforms=me.getUniforms(E),E.onBuild(G,Se,M),E.onBeforeCompile(Se,M),Le=me.acquireProgram(Se,Ae),Ge.set(Ae,Le),H.uniforms=Se.uniforms;const Ie=H.uniforms;return(!E.isShaderMaterial&&!E.isRawShaderMaterial||E.clipping===!0)&&(Ie.clippingPlanes=Be.uniform),ea(E,Se),H.needsLights=bh(E),H.lightsStateVersion=ge,H.needsLights&&(Ie.ambientLightColor.value=F.state.ambient,Ie.lightProbe.value=F.state.probe,Ie.directionalLights.value=F.state.directional,Ie.directionalLightShadows.value=F.state.directionalShadow,Ie.spotLights.value=F.state.spot,Ie.spotLightShadows.value=F.state.spotShadow,Ie.rectAreaLights.value=F.state.rectArea,Ie.ltc_1.value=F.state.rectAreaLTC1,Ie.ltc_2.value=F.state.rectAreaLTC2,Ie.pointLights.value=F.state.point,Ie.pointLightShadows.value=F.state.pointShadow,Ie.hemisphereLights.value=F.state.hemi,Ie.directionalShadowMap.value=F.state.directionalShadowMap,Ie.directionalShadowMatrix.value=F.state.directionalShadowMatrix,Ie.spotShadowMap.value=F.state.spotShadowMap,Ie.spotLightMatrix.value=F.state.spotLightMatrix,Ie.spotLightMap.value=F.state.spotLightMap,Ie.pointShadowMap.value=F.state.pointShadowMap,Ie.pointShadowMatrix.value=F.state.pointShadowMatrix),H.currentProgram=Le,H.uniformsList=null,Le}function Qo(E){if(E.uniformsList===null){const U=E.currentProgram.getUniforms();E.uniformsList=Qr.seqWithValue(U.seq,E.uniforms)}return E.uniformsList}function ea(E,U){const G=Fe.get(E);G.outputColorSpace=U.outputColorSpace,G.batching=U.batching,G.instancing=U.instancing,G.instancingColor=U.instancingColor,G.skinning=U.skinning,G.morphTargets=U.morphTargets,G.morphNormals=U.morphNormals,G.morphColors=U.morphColors,G.morphTargetsCount=U.morphTargetsCount,G.numClippingPlanes=U.numClippingPlanes,G.numIntersection=U.numClipIntersection,G.vertexAlphas=U.vertexAlphas,G.vertexTangents=U.vertexTangents,G.toneMapping=U.toneMapping}function Eh(E,U,G,H,F){U.isScene!==!0&&(U=Te),A.resetTextureUnits();const ue=U.fog,ge=H.isMeshStandardMaterial?U.environment:null,Se=C===null?M.outputColorSpace:C.isXRRenderTarget===!0?C.texture.colorSpace:xn,Ae=(H.isMeshStandardMaterial?B:x).get(H.envMap||ge),Ge=H.vertexColors===!0&&!!G.attributes.color&&G.attributes.color.itemSize===4,Le=!!G.attributes.tangent&&(!!H.normalMap||H.anisotropy>0),Ie=!!G.morphAttributes.position,at=!!G.morphAttributes.normal,Ot=!!G.morphAttributes.color;let ft=Un;H.toneMapped&&(C===null||C.isXRRenderTarget===!0)&&(ft=M.toneMapping);const hn=G.morphAttributes.position||G.morphAttributes.normal||G.morphAttributes.color,nt=hn!==void 0?hn.length:0,ke=Fe.get(H),Es=m.state.lights;if($===!0&&(he===!0||E!==S)){const Ht=E===S&&H.id===V;Be.setState(H,E,Ht)}let st=!1;H.version===ke.__version?(ke.needsLights&&ke.lightsStateVersion!==Es.state.version||ke.outputColorSpace!==Se||F.isBatchedMesh&&ke.batching===!1||!F.isBatchedMesh&&ke.batching===!0||F.isInstancedMesh&&ke.instancing===!1||!F.isInstancedMesh&&ke.instancing===!0||F.isSkinnedMesh&&ke.skinning===!1||!F.isSkinnedMesh&&ke.skinning===!0||F.isInstancedMesh&&ke.instancingColor===!0&&F.instanceColor===null||F.isInstancedMesh&&ke.instancingColor===!1&&F.instanceColor!==null||ke.envMap!==Ae||H.fog===!0&&ke.fog!==ue||ke.numClippingPlanes!==void 0&&(ke.numClippingPlanes!==Be.numPlanes||ke.numIntersection!==Be.numIntersection)||ke.vertexAlphas!==Ge||ke.vertexTangents!==Le||ke.morphTargets!==Ie||ke.morphNormals!==at||ke.morphColors!==Ot||ke.toneMapping!==ft||Pe.isWebGL2===!0&&ke.morphTargetsCount!==nt)&&(st=!0):(st=!0,ke.__version=H.version);let Gn=ke.currentProgram;st===!0&&(Gn=mr(H,U,F));let ta=!1,Wi=!1,Ts=!1;const St=Gn.getUniforms(),zn=ke.uniforms;if(pe.useProgram(Gn.program)&&(ta=!0,Wi=!0,Ts=!0),H.id!==V&&(V=H.id,Wi=!0),ta||S!==E){St.setValue(O,"projectionMatrix",E.projectionMatrix),St.setValue(O,"viewMatrix",E.matrixWorldInverse);const Ht=St.map.cameraPosition;Ht!==void 0&&Ht.setValue(O,Ue.setFromMatrixPosition(E.matrixWorld)),Pe.logarithmicDepthBuffer&&St.setValue(O,"logDepthBufFC",2/(Math.log(E.far+1)/Math.LN2)),(H.isMeshPhongMaterial||H.isMeshToonMaterial||H.isMeshLambertMaterial||H.isMeshBasicMaterial||H.isMeshStandardMaterial||H.isShaderMaterial)&&St.setValue(O,"isOrthographic",E.isOrthographicCamera===!0),S!==E&&(S=E,Wi=!0,Ts=!0)}if(F.isSkinnedMesh){St.setOptional(O,F,"bindMatrix"),St.setOptional(O,F,"bindMatrixInverse");const Ht=F.skeleton;Ht&&(Pe.floatVertexTextures?(Ht.boneTexture===null&&Ht.computeBoneTexture(),St.setValue(O,"boneTexture",Ht.boneTexture,A)):console.warn("THREE.WebGLRenderer: SkinnedMesh can only be used with WebGL 2. With WebGL 1 OES_texture_float and vertex textures support is required."))}F.isBatchedMesh&&(St.setOptional(O,F,"batchingTexture"),St.setValue(O,"batchingTexture",F._matricesTexture,A));const bs=G.morphAttributes;if((bs.position!==void 0||bs.normal!==void 0||bs.color!==void 0&&Pe.isWebGL2===!0)&&Ve.update(F,G,Gn),(Wi||ke.receiveShadow!==F.receiveShadow)&&(ke.receiveShadow=F.receiveShadow,St.setValue(O,"receiveShadow",F.receiveShadow)),H.isMeshGouraudMaterial&&H.envMap!==null&&(zn.envMap.value=Ae,zn.flipEnvMap.value=Ae.isCubeTexture&&Ae.isRenderTargetTexture===!1?-1:1),Wi&&(St.setValue(O,"toneMappingExposure",M.toneMappingExposure),ke.needsLights&&Th(zn,Ts),ue&&H.fog===!0&&le.refreshFogUniforms(zn,ue),le.refreshMaterialUniforms(zn,H,j,W,ve),Qr.upload(O,Qo(ke),zn,A)),H.isShaderMaterial&&H.uniformsNeedUpdate===!0&&(Qr.upload(O,Qo(ke),zn,A),H.uniformsNeedUpdate=!1),H.isSpriteMaterial&&St.setValue(O,"center",F.center),St.setValue(O,"modelViewMatrix",F.modelViewMatrix),St.setValue(O,"normalMatrix",F.normalMatrix),St.setValue(O,"modelMatrix",F.matrixWorld),H.isShaderMaterial||H.isRawShaderMaterial){const Ht=H.uniformsGroups;for(let As=0,Ah=Ht.length;As<Ah;As++)if(Pe.isWebGL2){const na=Ht[As];Ye.update(na,Gn),Ye.bind(na,Gn)}else console.warn("THREE.WebGLRenderer: Uniform Buffer Objects can only be used with WebGL 2.")}return Gn}function Th(E,U){E.ambientLightColor.needsUpdate=U,E.lightProbe.needsUpdate=U,E.directionalLights.needsUpdate=U,E.directionalLightShadows.needsUpdate=U,E.pointLights.needsUpdate=U,E.pointLightShadows.needsUpdate=U,E.spotLights.needsUpdate=U,E.spotLightShadows.needsUpdate=U,E.rectAreaLights.needsUpdate=U,E.hemisphereLights.needsUpdate=U}function bh(E){return E.isMeshLambertMaterial||E.isMeshToonMaterial||E.isMeshPhongMaterial||E.isMeshStandardMaterial||E.isShadowMaterial||E.isShaderMaterial&&E.lights===!0}this.getActiveCubeFace=function(){return L},this.getActiveMipmapLevel=function(){return R},this.getRenderTarget=function(){return C},this.setRenderTargetTextures=function(E,U,G){Fe.get(E.texture).__webglTexture=U,Fe.get(E.depthTexture).__webglTexture=G;const H=Fe.get(E);H.__hasExternalTextures=!0,H.__hasExternalTextures&&(H.__autoAllocateDepthBuffer=G===void 0,H.__autoAllocateDepthBuffer||xe.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),H.__useRenderToTexture=!1))},this.setRenderTargetFramebuffer=function(E,U){const G=Fe.get(E);G.__webglFramebuffer=U,G.__useDefaultFramebuffer=U===void 0},this.setRenderTarget=function(E,U=0,G=0){C=E,L=U,R=G;let H=!0,F=null,ue=!1,ge=!1;if(E){const Ae=Fe.get(E);Ae.__useDefaultFramebuffer!==void 0?(pe.bindFramebuffer(O.FRAMEBUFFER,null),H=!1):Ae.__webglFramebuffer===void 0?A.setupRenderTarget(E):Ae.__hasExternalTextures&&A.rebindTextures(E,Fe.get(E.texture).__webglTexture,Fe.get(E.depthTexture).__webglTexture);const Ge=E.texture;(Ge.isData3DTexture||Ge.isDataArrayTexture||Ge.isCompressedArrayTexture)&&(ge=!0);const Le=Fe.get(E).__webglFramebuffer;E.isWebGLCubeRenderTarget?(Array.isArray(Le[U])?F=Le[U][G]:F=Le[U],ue=!0):Pe.isWebGL2&&E.samples>0&&A.useMultisampledRTT(E)===!1?F=Fe.get(E).__webglMultisampledFramebuffer:Array.isArray(Le)?F=Le[G]:F=Le,b.copy(E.viewport),z.copy(E.scissor),k=E.scissorTest}else b.copy(K).multiplyScalar(j).floor(),z.copy(ne).multiplyScalar(j).floor(),k=ie;if(pe.bindFramebuffer(O.FRAMEBUFFER,F)&&Pe.drawBuffers&&H&&pe.drawBuffers(E,F),pe.viewport(b),pe.scissor(z),pe.setScissorTest(k),ue){const Ae=Fe.get(E.texture);O.framebufferTexture2D(O.FRAMEBUFFER,O.COLOR_ATTACHMENT0,O.TEXTURE_CUBE_MAP_POSITIVE_X+U,Ae.__webglTexture,G)}else if(ge){const Ae=Fe.get(E.texture),Ge=U||0;O.framebufferTextureLayer(O.FRAMEBUFFER,O.COLOR_ATTACHMENT0,Ae.__webglTexture,G||0,Ge)}V=-1},this.readRenderTargetPixels=function(E,U,G,H,F,ue,ge){if(!(E&&E.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Se=Fe.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&ge!==void 0&&(Se=Se[ge]),Se){pe.bindFramebuffer(O.FRAMEBUFFER,Se);try{const Ae=E.texture,Ge=Ae.format,Le=Ae.type;if(Ge!==sn&&fe.convert(Ge)!==O.getParameter(O.IMPLEMENTATION_COLOR_READ_FORMAT)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}const Ie=Le===or&&(xe.has("EXT_color_buffer_half_float")||Pe.isWebGL2&&xe.has("EXT_color_buffer_float"));if(Le!==Nn&&fe.convert(Le)!==O.getParameter(O.IMPLEMENTATION_COLOR_READ_TYPE)&&!(Le===Pn&&(Pe.isWebGL2||xe.has("OES_texture_float")||xe.has("WEBGL_color_buffer_float")))&&!Ie){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}U>=0&&U<=E.width-H&&G>=0&&G<=E.height-F&&O.readPixels(U,G,H,F,fe.convert(Ge),fe.convert(Le),ue)}finally{const Ae=C!==null?Fe.get(C).__webglFramebuffer:null;pe.bindFramebuffer(O.FRAMEBUFFER,Ae)}}},this.copyFramebufferToTexture=function(E,U,G=0){const H=Math.pow(2,-G),F=Math.floor(U.image.width*H),ue=Math.floor(U.image.height*H);A.setTexture2D(U,0),O.copyTexSubImage2D(O.TEXTURE_2D,G,0,0,E.x,E.y,F,ue),pe.unbindTexture()},this.copyTextureToTexture=function(E,U,G,H=0){const F=U.image.width,ue=U.image.height,ge=fe.convert(G.format),Se=fe.convert(G.type);A.setTexture2D(G,0),O.pixelStorei(O.UNPACK_FLIP_Y_WEBGL,G.flipY),O.pixelStorei(O.UNPACK_PREMULTIPLY_ALPHA_WEBGL,G.premultiplyAlpha),O.pixelStorei(O.UNPACK_ALIGNMENT,G.unpackAlignment),U.isDataTexture?O.texSubImage2D(O.TEXTURE_2D,H,E.x,E.y,F,ue,ge,Se,U.image.data):U.isCompressedTexture?O.compressedTexSubImage2D(O.TEXTURE_2D,H,E.x,E.y,U.mipmaps[0].width,U.mipmaps[0].height,ge,U.mipmaps[0].data):O.texSubImage2D(O.TEXTURE_2D,H,E.x,E.y,ge,Se,U.image),H===0&&G.generateMipmaps&&O.generateMipmap(O.TEXTURE_2D),pe.unbindTexture()},this.copyTextureToTexture3D=function(E,U,G,H,F=0){if(M.isWebGL1Renderer){console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: can only be used with WebGL2.");return}const ue=E.max.x-E.min.x+1,ge=E.max.y-E.min.y+1,Se=E.max.z-E.min.z+1,Ae=fe.convert(H.format),Ge=fe.convert(H.type);let Le;if(H.isData3DTexture)A.setTexture3D(H,0),Le=O.TEXTURE_3D;else if(H.isDataArrayTexture||H.isCompressedArrayTexture)A.setTexture2DArray(H,0),Le=O.TEXTURE_2D_ARRAY;else{console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: only supports THREE.DataTexture3D and THREE.DataTexture2DArray.");return}O.pixelStorei(O.UNPACK_FLIP_Y_WEBGL,H.flipY),O.pixelStorei(O.UNPACK_PREMULTIPLY_ALPHA_WEBGL,H.premultiplyAlpha),O.pixelStorei(O.UNPACK_ALIGNMENT,H.unpackAlignment);const Ie=O.getParameter(O.UNPACK_ROW_LENGTH),at=O.getParameter(O.UNPACK_IMAGE_HEIGHT),Ot=O.getParameter(O.UNPACK_SKIP_PIXELS),ft=O.getParameter(O.UNPACK_SKIP_ROWS),hn=O.getParameter(O.UNPACK_SKIP_IMAGES),nt=G.isCompressedTexture?G.mipmaps[F]:G.image;O.pixelStorei(O.UNPACK_ROW_LENGTH,nt.width),O.pixelStorei(O.UNPACK_IMAGE_HEIGHT,nt.height),O.pixelStorei(O.UNPACK_SKIP_PIXELS,E.min.x),O.pixelStorei(O.UNPACK_SKIP_ROWS,E.min.y),O.pixelStorei(O.UNPACK_SKIP_IMAGES,E.min.z),G.isDataTexture||G.isData3DTexture?O.texSubImage3D(Le,F,U.x,U.y,U.z,ue,ge,Se,Ae,Ge,nt.data):G.isCompressedArrayTexture?(console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: untested support for compressed srcTexture."),O.compressedTexSubImage3D(Le,F,U.x,U.y,U.z,ue,ge,Se,Ae,nt.data)):O.texSubImage3D(Le,F,U.x,U.y,U.z,ue,ge,Se,Ae,Ge,nt),O.pixelStorei(O.UNPACK_ROW_LENGTH,Ie),O.pixelStorei(O.UNPACK_IMAGE_HEIGHT,at),O.pixelStorei(O.UNPACK_SKIP_PIXELS,Ot),O.pixelStorei(O.UNPACK_SKIP_ROWS,ft),O.pixelStorei(O.UNPACK_SKIP_IMAGES,hn),F===0&&H.generateMipmaps&&O.generateMipmap(Le),pe.unbindTexture()},this.initTexture=function(E){E.isCubeTexture?A.setTextureCube(E,0):E.isData3DTexture?A.setTexture3D(E,0):E.isDataArrayTexture||E.isCompressedArrayTexture?A.setTexture2DArray(E,0):A.setTexture2D(E,0),pe.unbindTexture()},this.resetState=function(){L=0,R=0,C=null,pe.reset(),Ne.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return vn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=e===Go?"display-p3":"srgb",t.unpackColorSpace=Ke.workingColorSpace===gs?"display-p3":"srgb"}get outputEncoding(){return console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead."),this.outputColorSpace===Mt?ti:Rc}set outputEncoding(e){console.warn("THREE.WebGLRenderer: Property .outputEncoding has been removed. Use .outputColorSpace instead."),this.outputColorSpace=e===ti?Mt:xn}get useLegacyLights(){return console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights}set useLegacyLights(e){console.warn("THREE.WebGLRenderer: The property .useLegacyLights has been deprecated. Migrate your lighting according to the following guide: https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733."),this._useLegacyLights=e}}class Dg extends Kc{}Dg.prototype.isWebGL1Renderer=!0;class Vo{constructor(e,t=25e-5){this.isFogExp2=!0,this.name="",this.color=new We(e),this.density=t}clone(){return new Vo(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}}class Ig extends _t{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t}}class Ug{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=Ao,this._updateRange={offset:0,count:-1},this.updateRanges=[],this.version=0,this.uuid=On()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}get updateRange(){return console.warn("THREE.InterleavedBuffer: updateRange() is deprecated and will be removed in r169. Use addUpdateRange() instead."),this._updateRange}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let r=0,s=this.stride;r<s;r++)this.array[e+r]=t.array[n+r];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=On()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=On()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const Rt=new P;class os{constructor(e,t,n,r=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=r}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)Rt.fromBufferAttribute(this,t),Rt.applyMatrix4(e),this.setXYZ(t,Rt.x,Rt.y,Rt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Rt.fromBufferAttribute(this,t),Rt.applyNormalMatrix(e),this.setXYZ(t,Rt.x,Rt.y,Rt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Rt.fromBufferAttribute(this,t),Rt.transformDirection(e),this.setXYZ(t,Rt.x,Rt.y,Rt.z);return this}setX(e,t){return this.normalized&&(t=$e(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=$e(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=$e(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=$e(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=_n(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=_n(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=_n(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=_n(t,this.array)),t}setXY(e,t,n){return e=e*this.data.stride+this.offset,this.normalized&&(t=$e(t,this.array),n=$e(n,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=$e(t,this.array),n=$e(n,this.array),r=$e(r,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=r,this}setXYZW(e,t,n,r,s){return e=e*this.data.stride+this.offset,this.normalized&&(t=$e(t,this.array),n=$e(n,this.array),r=$e(r,this.array),s=$e(s,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=r,this.data.array[e+3]=s,this}clone(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let n=0;n<this.count;n++){const r=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[r+s])}return new $t(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new os(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let n=0;n<this.count;n++){const r=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[r+s])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class Wo extends ci{constructor(e){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new We(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}let Ai;const Ki=new P,wi=new P,Ri=new P,Ci=new Re,$i=new Re,$c=new it,Br=new P,Ji=new P,Gr=new P,Sl=new Re,ro=new Re,El=new Re;class Jc extends _t{constructor(e=new Wo){if(super(),this.isSprite=!0,this.type="Sprite",Ai===void 0){Ai=new Zt;const t=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new Ug(t,5);Ai.setIndex([0,1,2,0,2,3]),Ai.setAttribute("position",new os(n,3,0,!1)),Ai.setAttribute("uv",new os(n,2,3,!1))}this.geometry=Ai,this.material=e,this.center=new Re(.5,.5)}raycast(e,t){e.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),wi.setFromMatrixScale(this.matrixWorld),$c.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),Ri.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&wi.multiplyScalar(-Ri.z);const n=this.material.rotation;let r,s;n!==0&&(s=Math.cos(n),r=Math.sin(n));const l=this.center;zr(Br.set(-.5,-.5,0),Ri,l,wi,r,s),zr(Ji.set(.5,-.5,0),Ri,l,wi,r,s),zr(Gr.set(.5,.5,0),Ri,l,wi,r,s),Sl.set(0,0),ro.set(1,0),El.set(1,1);let o=e.ray.intersectTriangle(Br,Ji,Gr,!1,Ki);if(o===null&&(zr(Ji.set(-.5,.5,0),Ri,l,wi,r,s),ro.set(0,1),o=e.ray.intersectTriangle(Br,Gr,Ji,!1,Ki),o===null))return;const c=e.ray.origin.distanceTo(Ki);c<e.near||c>e.far||t.push({distance:c,point:Ki.clone(),uv:Xt.getInterpolation(Ki,Br,Ji,Gr,Sl,ro,El,new Re),face:null,object:this})}copy(e,t){return super.copy(e,t),e.center!==void 0&&this.center.copy(e.center),this.material=e.material,this}}function zr(i,e,t,n,r,s){Ci.subVectors(i,t).addScalar(.5).multiply(n),r!==void 0?($i.x=s*Ci.x-r*Ci.y,$i.y=r*Ci.x+s*Ci.y):$i.copy(Ci),i.copy(e),i.x+=$i.x,i.y+=$i.y,i.applyMatrix4($c)}class Tl extends $t{constructor(e,t,n,r=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){const e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}}const Pi=new it,bl=new it,kr=[],Al=new li,Ng=new it,Zi=new ce,Qi=new ur;class Og extends ce{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new Tl(new Float32Array(n*16),16),this.instanceColor=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let r=0;r<n;r++)this.setMatrixAt(r,Ng)}computeBoundingBox(){const e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new li),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Pi),Al.copy(e.boundingBox).applyMatrix4(Pi),this.boundingBox.union(Al)}computeBoundingSphere(){const e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new ur),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Pi),Qi.copy(e.boundingSphere).applyMatrix4(Pi),this.boundingSphere.union(Qi)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,e*16)}raycast(e,t){const n=this.matrixWorld,r=this.count;if(Zi.geometry=this.geometry,Zi.material=this.material,Zi.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Qi.copy(this.boundingSphere),Qi.applyMatrix4(n),e.ray.intersectsSphere(Qi)!==!1))for(let s=0;s<r;s++){this.getMatrixAt(s,Pi),bl.multiplyMatrices(n,Pi),Zi.matrixWorld=bl,Zi.raycast(e,kr);for(let l=0,o=kr.length;l<o;l++){const c=kr[l];c.instanceId=s,c.object=this,t.push(c)}kr.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new Tl(new Float32Array(this.instanceMatrix.count*3),3)),t.toArray(this.instanceColor.array,e*3)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,e*16)}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"})}}class dr extends Nt{constructor(e,t,n,r,s,l,o,c,h){super(e,t,n,r,s,l,o,c,h),this.isCanvasTexture=!0,this.needsUpdate=!0}}class gt extends Zt{constructor(e=1,t=1,n=1,r=32,s=1,l=!1,o=0,c=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:r,heightSegments:s,openEnded:l,thetaStart:o,thetaLength:c};const h=this;r=Math.floor(r),s=Math.floor(s);const u=[],d=[],p=[],g=[];let v=0;const _=[],m=n/2;let f=0;y(),l===!1&&(e>0&&M(!0),t>0&&M(!1)),this.setIndex(u),this.setAttribute("position",new ct(d,3)),this.setAttribute("normal",new ct(p,3)),this.setAttribute("uv",new ct(g,2));function y(){const T=new P,L=new P;let R=0;const C=(t-e)/n;for(let V=0;V<=s;V++){const S=[],b=V/s,z=b*(t-e)+e;for(let k=0;k<=r;k++){const Q=k/r,I=Q*c+o,N=Math.sin(I),W=Math.cos(I);L.x=z*N,L.y=-b*n+m,L.z=z*W,d.push(L.x,L.y,L.z),T.set(N,C,W).normalize(),p.push(T.x,T.y,T.z),g.push(Q,1-b),S.push(v++)}_.push(S)}for(let V=0;V<r;V++)for(let S=0;S<s;S++){const b=_[S][V],z=_[S+1][V],k=_[S+1][V+1],Q=_[S][V+1];u.push(b,z,Q),u.push(z,k,Q),R+=6}h.addGroup(f,R,0),f+=R}function M(T){const L=v,R=new Re,C=new P;let V=0;const S=T===!0?e:t,b=T===!0?1:-1;for(let k=1;k<=r;k++)d.push(0,m*b,0),p.push(0,b,0),g.push(.5,.5),v++;const z=v;for(let k=0;k<=r;k++){const I=k/r*c+o,N=Math.cos(I),W=Math.sin(I);C.x=S*W,C.y=m*b,C.z=S*N,d.push(C.x,C.y,C.z),p.push(0,b,0),R.x=N*.5+.5,R.y=W*.5*b+.5,g.push(R.x,R.y),v++}for(let k=0;k<r;k++){const Q=L+k,I=z+k;T===!0?u.push(I,I+1,Q):u.push(I+1,I,Q),V+=3}h.addGroup(f,V,T===!0?1:2),f+=V}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new gt(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class Xo extends Zt{constructor(e=[],t=[],n=1,r=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:n,detail:r};const s=[],l=[];o(r),h(n),u(),this.setAttribute("position",new ct(s,3)),this.setAttribute("normal",new ct(s.slice(),3)),this.setAttribute("uv",new ct(l,2)),r===0?this.computeVertexNormals():this.normalizeNormals();function o(y){const M=new P,T=new P,L=new P;for(let R=0;R<t.length;R+=3)g(t[R+0],M),g(t[R+1],T),g(t[R+2],L),c(M,T,L,y)}function c(y,M,T,L){const R=L+1,C=[];for(let V=0;V<=R;V++){C[V]=[];const S=y.clone().lerp(T,V/R),b=M.clone().lerp(T,V/R),z=R-V;for(let k=0;k<=z;k++)k===0&&V===R?C[V][k]=S:C[V][k]=S.clone().lerp(b,k/z)}for(let V=0;V<R;V++)for(let S=0;S<2*(R-V)-1;S++){const b=Math.floor(S/2);S%2===0?(p(C[V][b+1]),p(C[V+1][b]),p(C[V][b])):(p(C[V][b+1]),p(C[V+1][b+1]),p(C[V+1][b]))}}function h(y){const M=new P;for(let T=0;T<s.length;T+=3)M.x=s[T+0],M.y=s[T+1],M.z=s[T+2],M.normalize().multiplyScalar(y),s[T+0]=M.x,s[T+1]=M.y,s[T+2]=M.z}function u(){const y=new P;for(let M=0;M<s.length;M+=3){y.x=s[M+0],y.y=s[M+1],y.z=s[M+2];const T=m(y)/2/Math.PI+.5,L=f(y)/Math.PI+.5;l.push(T,1-L)}v(),d()}function d(){for(let y=0;y<l.length;y+=6){const M=l[y+0],T=l[y+2],L=l[y+4],R=Math.max(M,T,L),C=Math.min(M,T,L);R>.9&&C<.1&&(M<.2&&(l[y+0]+=1),T<.2&&(l[y+2]+=1),L<.2&&(l[y+4]+=1))}}function p(y){s.push(y.x,y.y,y.z)}function g(y,M){const T=y*3;M.x=e[T+0],M.y=e[T+1],M.z=e[T+2]}function v(){const y=new P,M=new P,T=new P,L=new P,R=new Re,C=new Re,V=new Re;for(let S=0,b=0;S<s.length;S+=9,b+=6){y.set(s[S+0],s[S+1],s[S+2]),M.set(s[S+3],s[S+4],s[S+5]),T.set(s[S+6],s[S+7],s[S+8]),R.set(l[b+0],l[b+1]),C.set(l[b+2],l[b+3]),V.set(l[b+4],l[b+5]),L.copy(y).add(M).add(T).divideScalar(3);const z=m(L);_(R,b+0,y,z),_(C,b+2,M,z),_(V,b+4,T,z)}}function _(y,M,T,L){L<0&&y.x===1&&(l[M]=y.x-1),T.x===0&&T.z===0&&(l[M]=L/2/Math.PI+.5)}function m(y){return Math.atan2(y.z,-y.x)}function f(y){return Math.atan2(-y.y,Math.sqrt(y.x*y.x+y.z*y.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Xo(e.vertices,e.indices,e.radius,e.details)}}class qo extends Xo{constructor(e=1,t=0){const n=(1+Math.sqrt(5))/2,r=1/n,s=[-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-r,-n,0,-r,n,0,r,-n,0,r,n,-r,-n,0,-r,n,0,r,-n,0,r,n,0,-n,0,-r,n,0,-r,-n,0,r,n,0,r],l=[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9];super(s,l,e,t),this.type="DodecahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new qo(e.radius,e.detail)}}class Yo extends Zt{constructor(e=.5,t=1,n=32,r=1,s=0,l=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:e,outerRadius:t,thetaSegments:n,phiSegments:r,thetaStart:s,thetaLength:l},n=Math.max(3,n),r=Math.max(1,r);const o=[],c=[],h=[],u=[];let d=e;const p=(t-e)/r,g=new P,v=new Re;for(let _=0;_<=r;_++){for(let m=0;m<=n;m++){const f=s+m/n*l;g.x=d*Math.cos(f),g.y=d*Math.sin(f),c.push(g.x,g.y,g.z),h.push(0,0,1),v.x=(g.x/t+1)/2,v.y=(g.y/t+1)/2,u.push(v.x,v.y)}d+=p}for(let _=0;_<r;_++){const m=_*(n+1);for(let f=0;f<n;f++){const y=f+m,M=y,T=y+n+1,L=y+n+2,R=y+1;o.push(M,T,R),o.push(T,L,R)}}this.setIndex(o),this.setAttribute("position",new ct(c,3)),this.setAttribute("normal",new ct(h,3)),this.setAttribute("uv",new ct(u,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Yo(e.innerRadius,e.outerRadius,e.thetaSegments,e.phiSegments,e.thetaStart,e.thetaLength)}}class vs extends Zt{constructor(e=1,t=32,n=16,r=0,s=Math.PI*2,l=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:r,phiLength:s,thetaStart:l,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));const c=Math.min(l+o,Math.PI);let h=0;const u=[],d=new P,p=new P,g=[],v=[],_=[],m=[];for(let f=0;f<=n;f++){const y=[],M=f/n;let T=0;f===0&&l===0?T=.5/t:f===n&&c===Math.PI&&(T=-.5/t);for(let L=0;L<=t;L++){const R=L/t;d.x=-e*Math.cos(r+R*s)*Math.sin(l+M*o),d.y=e*Math.cos(l+M*o),d.z=e*Math.sin(r+R*s)*Math.sin(l+M*o),v.push(d.x,d.y,d.z),p.copy(d).normalize(),_.push(p.x,p.y,p.z),m.push(R+T,1-M),y.push(h++)}u.push(y)}for(let f=0;f<n;f++)for(let y=0;y<t;y++){const M=u[f][y+1],T=u[f][y],L=u[f+1][y],R=u[f+1][y+1];(f!==0||l>0)&&g.push(M,T,R),(f!==n-1||c<Math.PI)&&g.push(T,L,R)}this.setIndex(g),this.setAttribute("position",new ct(v,3)),this.setAttribute("normal",new ct(_,3)),this.setAttribute("uv",new ct(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new vs(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}}class Lt extends ci{constructor(e){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.type="MeshStandardMaterial",this.color=new We(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new We(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Bo,this.normalScale=new Re(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class Ms extends ci{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new We(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new We(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Bo,this.normalScale=new Re(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=Oo,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class Zc extends _t{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new We(e),this.intensity=t}dispose(){}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),t}}const so=new it,wl=new P,Rl=new P;class Fg{constructor(e){this.camera=e,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Re(512,512),this.map=null,this.mapPass=null,this.matrix=new it,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new ko,this._frameExtents=new Re(1,1),this._viewportCount=1,this._viewports=[new mt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,n=this.matrix;wl.setFromMatrixPosition(e.matrixWorld),t.position.copy(wl),Rl.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Rl),t.updateMatrixWorld(),so.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(so),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(so)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.bias=e.bias,this.radius=e.radius,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}class Bg extends Fg{constructor(){super(new Hc(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class Gg extends Zc{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(_t.DEFAULT_UP),this.updateMatrix(),this.target=new _t,this.shadow=new Bg}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}class zg extends Zc{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type="AmbientLight"}}class Qc{constructor(e,t,n=0,r=1/0){this.ray=new Uc(e,t),this.near=n,this.far=r,this.camera=null,this.layers=new zo,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,(t.near+t.far)/(t.near-t.far)).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):console.error("THREE.Raycaster: Unsupported camera type: "+t.type)}intersectObject(e,t=!0,n=[]){return Lo(e,this,n,t),n.sort(Cl),n}intersectObjects(e,t=!0,n=[]){for(let r=0,s=e.length;r<s;r++)Lo(e[r],this,n,t);return n.sort(Cl),n}}function Cl(i,e){return i.distance-e.distance}function Lo(i,e,t,n){if(i.layers.test(e.layers)&&i.raycast(e,t),n===!0){const r=i.children;for(let s=0,l=r.length;s<l;s++)Lo(r[s],e,t,!0)}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:No}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=No);const Li=new Bn(0,0,0,"YXZ"),Di=new P,kg={type:"change"},Hg={type:"lock"},Vg={type:"unlock"},Pl=Math.PI/2;class Wg extends ai{constructor(e,t){super(),this.camera=e,this.domElement=t,this.isLocked=!1,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.pointerSpeed=1,this._onMouseMove=Xg.bind(this),this._onPointerlockChange=qg.bind(this),this._onPointerlockError=Yg.bind(this),this.connect()}connect(){this.domElement.ownerDocument.addEventListener("mousemove",this._onMouseMove),this.domElement.ownerDocument.addEventListener("pointerlockchange",this._onPointerlockChange),this.domElement.ownerDocument.addEventListener("pointerlockerror",this._onPointerlockError)}disconnect(){this.domElement.ownerDocument.removeEventListener("mousemove",this._onMouseMove),this.domElement.ownerDocument.removeEventListener("pointerlockchange",this._onPointerlockChange),this.domElement.ownerDocument.removeEventListener("pointerlockerror",this._onPointerlockError)}dispose(){this.disconnect()}getObject(){return this.camera}getDirection(e){return e.set(0,0,-1).applyQuaternion(this.camera.quaternion)}moveForward(e){const t=this.camera;Di.setFromMatrixColumn(t.matrix,0),Di.crossVectors(t.up,Di),t.position.addScaledVector(Di,e)}moveRight(e){const t=this.camera;Di.setFromMatrixColumn(t.matrix,0),t.position.addScaledVector(Di,e)}lock(){this.domElement.requestPointerLock()}unlock(){this.domElement.ownerDocument.exitPointerLock()}}function Xg(i){if(this.isLocked===!1)return;const e=i.movementX||i.mozMovementX||i.webkitMovementX||0,t=i.movementY||i.mozMovementY||i.webkitMovementY||0,n=this.camera;Li.setFromQuaternion(n.quaternion),Li.y-=e*.002*this.pointerSpeed,Li.x-=t*.002*this.pointerSpeed,Li.x=Math.max(Pl-this.maxPolarAngle,Math.min(Pl-this.minPolarAngle,Li.x)),n.quaternion.setFromEuler(Li),this.dispatchEvent(kg)}function qg(){this.domElement.ownerDocument.pointerLockElement===this.domElement?(this.dispatchEvent(Hg),this.isLocked=!0):(this.dispatchEvent(Vg),this.isLocked=!1)}function Yg(){console.error("THREE.PointerLockControls: Unable to use Pointer Lock API")}const an=680,Ll=104,Yt=6,jg=35,ar=.8,Dl=164,Ii=420,eh=225,Kg=275,oo=300,$g=.15,ao=350,Jg=2,Il=[{hp:1,color:49151,scale:1.5},{hp:3,color:3069299,scale:3},{hp:5,color:16753920,scale:4.5},{hp:10,color:16729943,scale:6}],Do=2,Ul=10,as=75,Zg=15,Qg=15,ls={PISTOL:{fireRate:.1,damage:1,recoil:.08,spread:.002,bulletColor:16711765},SHOTGUN:{fireRate:.6,damage:1,recoil:.22,spread:.08,bulletColor:16755200,pellets:5},AR:{fireRate:.15,damage:1,recoil:.12,spread:.002,bulletColor:65416},SNIPER:{fireRate:2,damage:10,recoil:.3,spread:0,bulletColor:16776960},MINIGUN:{fireRate:.06,damage:1,recoil:.02,spread:.002,bulletColor:16737792}},e_=500,t_=1,on=12.8,n_=33,i_=4,r_=.35,s_=150,Nl=300,Ol=.3,o_=1.6,a_=250,l_=180,c_=330,h_=345,u_=1155,d_=5,f_=3,p_=10,m_=.3,g_=.1,Fl=-4.5,Hr=35,Bl=1.5,__=3,v_=12,M_=3.5,Gl=35,zl=120,lo=400,x_=4e3,y_=340,co=50,S_=1.5,Io=3,E_=.3,kl=50,T_=1e3,yn=500,Hl=.25,Vl=10,Wl=20,b_=45,Xl=3500,a={moveForward:!1,moveBackward:!1,moveLeft:!1,moveRight:!1,canJump:!1,prevTime:performance.now(),velocity:new P,score:0,playerHp:Ul,playerMaxHp:Ul,lastDamageTime:0,isPlaying:!1,pendingPlay:!1,regenTimer:0,kills:0,deaths:0,isMultiplayer:!1,isHost:!1,roomCode:null,peer:null,connections:[],peers:{},peerIds:[],targets:[],obstacles:[],grappleSurfaces:[],projectiles:[],projectilePool:[],activeParticles:[],lavaPools:[],fakePillars:[],hookState:"IDLE",hookPosition:new P,hookTarget:new P,hookWillHit:!1,hookIsEnemy:!1,hookTargetEnemy:null,hookMesh:null,activeWeaponName:"PISTOL",nextWeaponName:null,desiredWeaponName:"PISTOL",switchState:"IDLE",switchTimer:0,fireCooldown:0,isMouseDown:!1,minigunRamp:0,inspectState:"IDLE",inspectTimer:0,camera:null,scene:null,renderer:null,controls:null,leftGun:null,rightGun:null,rightGunContainer:null,pistolMesh:null,shotgunMesh:null,arMesh:null,sniperMesh:null,minigunMesh:null,playerMesh:null,isThirdPerson:!1,isScoped:!1,rightClickActive:!1,keyCActive:!1,baseSensitivity:1,hoverFuel:1,isShiftDown:!1,isHovering:!1};function A_(){a.playerHp=a.playerMaxHp,a.score=0,a.kills=0,a.deaths=0,a.velocity.set(0,0,0),a.hookState="IDLE",a.hookPosition.set(0,0,0),a.hookTarget.set(0,0,0),a.hookWillHit=!1,a.hookIsEnemy=!1,a.hookTargetEnemy=null,a.hoverFuel=1,a.inspectState="IDLE",a.inspectTimer=0,a.minigunRamp=0}const jo=new Xe(1,1,1),th=new gt(.025,.025,1,6);th.rotateX(Math.PI/2);const nh=new Yo(.9,1,32);nh.rotateX(-Math.PI/2);const cs=[];function xs(i){if(cs.length>0){const e=cs.pop();return e.color.setHex(i),e.opacity=1,e}return new vt({color:i,transparent:!0,opacity:1})}function ql(i){cs.length<500?cs.push(i):i.dispose()}const hs=[];function w_(i){if(hs.length>0){const e=hs.pop();return e.color.setHex(i),e.opacity=.8,e}return new vt({color:i,transparent:!0,opacity:.8,side:It,depthWrite:!1})}function R_(i){hs.length<50?hs.push(i):i.dispose()}const C_=new gt(2.5,2.5,120,16),P_=new vt({color:43775,transparent:!0,opacity:.8,side:It});function Jt(i,e,t,n,r,s){if(a.activeParticles.length>=yn)return;const l=Math.min(t,yn-a.activeParticles.length);for(let o=0;o<l;o++){const c=xs(e),h=new ce(jo,c);h.position.copy(i),h.scale.setScalar(r),h.position.x+=(Math.random()-.5)*.5,h.position.y+=(Math.random()-.5)*.5,h.position.z+=(Math.random()-.5)*.5,a.scene.add(h);const u=(Math.random()-.5)*2,d=(Math.random()-.3)*2,p=(Math.random()-.5)*2,g=Math.sqrt(u*u+d*d+p*p),v=g>0?1/g:0,_=n*(.4+Math.random()*.8),m=u*v*_,f=d*v*_,y=p*v*_,M=.4+Math.random()*.5;a.activeParticles.push({mesh:h,kind:"spark",vx:m,vy:f,vz:y,gravity:s,life:M,maxLife:M})}}function ih(i,e,t=54015){if(a.activeParticles.length>=yn)return;const n=i.distanceTo(e);if(n<=0)return;const r=xs(t);r.opacity=.95;const s=new ce(th,r),l=new P().addVectors(i,e).multiplyScalar(.5);s.position.copy(l),s.scale.set(1,1,n),s.lookAt(e),a.scene.add(s),a.activeParticles.push({mesh:s,kind:"sniper-trail",life:Ol,maxLife:Ol})}function us(i){if(a.activeParticles.length>=yn)return;const e=120,t=new ce(C_,P_);t.position.set(i.x,e/2,i.z),a.scene.add(t);const n=1.2;a.activeParticles.push({mesh:t,kind:"lightbeam",life:n,maxLife:n});const r=new P(i.x,.5,i.z);Jt(r,43775,20,14,.4,-6)}function L_(i){for(let e=a.activeParticles.length-1;e>=0;e--){const t=a.activeParticles[e];if(t.life-=i,t.life<=0)a.scene.remove(t.mesh),t.kind==="spark"||t.kind==="rocket-flame"||t.kind==="maneuvering"||t.kind==="sniper-trail"?ql(t.mesh.material):t.kind==="shockwave"&&R_(t.mesh.material),a.activeParticles[e]=a.activeParticles[a.activeParticles.length-1],a.activeParticles.pop();else{const n=Math.max(0,t.life/t.maxLife);if(t.kind==="sniper-trail")t.mesh.material.opacity=n*.95,t.mesh.scale.x=n,t.mesh.scale.y=n;else if(t.kind==="shockwave"){const r=1+(t.targetScale-1)*(1-n);t.mesh.scale.setScalar(r),t.mesh.material.opacity=n*.7}else t.kind==="lightbeam"?(t.mesh.scale.x=n,t.mesh.scale.z=n):(t.vx!==void 0&&t.vy!==void 0&&t.vz!==void 0&&t.gravity!==void 0&&(t.vy-=t.gravity*i,t.mesh.position.x+=t.vx*i,t.mesh.position.y+=t.vy*i,t.mesh.position.z+=t.vz*i),t.mesh.scale.setScalar(n*t.maxLife),t.mesh.material.opacity=n)}}}function lr(i,e,t){if(a.activeParticles.length>=yn)return;const n=Math.min(e,yn-a.activeParticles.length);for(let r=0;r<n;r++){const s=t?Math.random()>.5?16771584:16763904:Math.random()>.4?16766720:16755200,l=xs(s);l.opacity=.95;const o=new ce(jo,l);o.position.copy(i),o.position.x+=(Math.random()-.5)*.3,o.position.y+=(Math.random()-.5)*.1,o.position.z+=(Math.random()-.5)*.3;const c=t?.25+Math.random()*.25:.15+Math.random()*.15;o.scale.setScalar(c),a.scene.add(o);const h=(Math.random()-.5)*(t?22:4),u=t?-8-Math.random()*20:-18-Math.random()*12,d=(Math.random()-.5)*(t?22:4),p=t?.3+Math.random()*.3:.25+Math.random()*.25;a.activeParticles.push({mesh:o,kind:"rocket-flame",vx:h,vy:u,vz:d,gravity:0,life:p,maxLife:p})}}function Ln(i,e,t){if(!t||t.lengthSq()===0||a.activeParticles.length>=yn)return;const n=Math.min(e,yn-a.activeParticles.length);for(let r=0;r<n;r++){const s=Math.random()>.5?16771584:16763904,l=xs(s);l.opacity=.95;const o=new ce(jo,l);o.position.copy(i),o.position.x+=t.x*.3+(Math.random()-.5)*.1,o.position.y+=(Math.random()-.5)*.1,o.position.z+=t.z*.3+(Math.random()-.5)*.1;const c=.06+Math.random()*.06;o.scale.setScalar(c),a.scene.add(o);const h=12+Math.random()*6,u=t.x*h+(Math.random()-.5)*1.5,d=-3-Math.random()*4,p=t.z*h+(Math.random()-.5)*1.5,g=.12+Math.random()*.12;a.activeParticles.push({mesh:o,kind:"maneuvering",vx:u,vy:d,vz:p,gravity:0,life:g,maxLife:g})}}function cr(i,e,t=16763904){if(a.activeParticles.length>=yn)return;const n=w_(t),r=new ce(nh,n);r.position.copy(i),r.position.y+=.05,a.scene.add(r),a.activeParticles.push({mesh:r,kind:"shockwave",targetScale:e,life:.4,maxLife:.4})}const Yl=new P,rr=new P,wn=new P,ho=new P,nr=new P,jl=new P,Kl=new P,uo=new Qc,D_=new Re(0,0),Ko=new P(0,0,-.19);let Dn=null;function kt(){a.hookState="IDLE",a.hookIsEnemy=!1,a.hookTargetEnemy=null,a.scene&&a.hookMesh&&a.scene.remove(a.hookMesh),Dn||(Dn=document.getElementById("hook-badge")),Dn&&(Dn.style.display="none")}function I_(){if(!(!a.scene||!a.camera||!a.leftGun||!a.controls))if(a.hookState==="IDLE"){a.hookState="FIRING",a.hookIsEnemy=!1,a.hookTargetEnemy=null,a.leftGun&&!a.isThirdPerson&&(a.leftGun.position.z+=.15),a.leftGun.updateWorldMatrix(!0,!1);const i=nr.copy(Ko);a.leftGun.localToWorld(i),a.hookPosition.copy(i),uo.setFromCamera(D_,a.camera);const e=uo.ray,t=a.controls.getObject();let n=null,r=1/0;const s=a.targets.length;for(let c=0;c<s;c++){const h=a.targets[c],u=h.position,d=e.distanceToPoint(u),p=h.userData.scale||1,g=M_*p;if(d<=g){const v=t.position.distanceTo(u);rr.subVectors(u,t.position),rr.dot(e.direction)>0&&v<=oo+p&&v<r&&(r=v,n={target:h,distance:v})}}const l=uo.intersectObjects(a.grappleSurfaces);let o=null;l.length>0&&l[0].distance<=oo&&(o=l[0]),n&&(!o||n.distance<=o.distance)?(a.hookTargetEnemy=n.target,a.hookTarget.copy(a.hookTargetEnemy.position),a.hookWillHit=!0,a.hookIsEnemy=!0):o?(a.hookTarget.copy(o.point),a.hookWillHit=!0,a.hookIsEnemy=!1):(a.camera.getWorldDirection(Kl),a.hookTarget.copy(t.position).addScaledVector(Kl,oo),a.hookWillHit=!1,a.hookIsEnemy=!1),a.scene.add(a.hookMesh)}else kt()}function U_(i){if(a.hookState!=="IDLE"){if(!a.controls)return;const e=a.controls.getObject();if(a.hookState==="FIRING")Yl.subVectors(a.hookTarget,a.hookPosition).normalize(),a.hookPosition.addScaledVector(Yl,Nl*i),a.hookPosition.distanceTo(a.hookTarget)<1.5&&(a.hookWillHit?(a.hookState="PULLING",Dn||(Dn=document.getElementById("hook-badge")),Dn&&(Dn.style.display="inline-block")):kt());else if(a.hookState==="PULLING")if(a.hookIsEnemy&&a.hookTargetEnemy)if(a.hookTarget.copy(a.hookTargetEnemy.position),rr.subVectors(a.hookTarget,e.position),rr.length()>__){wn.copy(rr).normalize();const n=Nl*.75;a.velocity.copy(wn).multiplyScalar(n)}else kt();else if(ho.subVectors(a.hookTarget,e.position),ho.length()>v_){wn.copy(ho).normalize(),a.velocity.x+=wn.x*lo*i,a.velocity.y+=wn.y*lo*i,a.velocity.z+=wn.z*lo*i;const n=a.velocity.dot(wn);n<Gl&&a.velocity.addScaledVector(wn,Gl-n),a.velocity.length()>zl&&a.velocity.setLength(zl)}else kt();if(a.leftGun&&a.hookMesh){a.leftGun.updateWorldMatrix(!0,!1),nr.copy(Ko),a.leftGun.localToWorld(nr);const t=nr.distanceTo(a.hookPosition);t>.05&&(jl.addVectors(nr,a.hookPosition).multiplyScalar(.5),a.hookMesh.position.copy(jl),a.hookMesh.scale.set(1,1,t),a.hookMesh.lookAt(a.hookPosition))}}}const Xn=new P,qn=new P,Gt=new P,N_=new P,O_=new P,Yn=new P,$l=new P,Jl=new P;let Vr=null,Wr=null,Xr=null;const qr=an/2-1;function F_(i,e,t,n){let r=0,s=!1,l=!1;(Math.abs(e.x)>qr||Math.abs(e.z)>qr)&&(s=!0),(Math.abs(t.x)>qr||Math.abs(t.z)>qr)&&(l=!0);const o=a.obstacles.length;for(let c=0;c<o;c++){const h=a.obstacles[c],u=h.userData.height,d=h.userData.halfW||Yt/2,p=h.userData.halfD||Yt/2,g=d+ar,v=p+ar,_=h.position.x,m=h.position.z;!s&&e.x>_-g&&e.x<_+g&&e.z>m-v&&e.z<m+v&&n<u-.3&&(s=!0),!l&&t.x>_-g&&t.x<_+g&&t.z>m-v&&t.z<m+v&&n<u-.3&&(l=!0),i.x>_-g&&i.x<_+g&&i.z>m-v&&i.z<m+v&&u>r&&(r=u)}return{colX:s,colZ:l,groundY:r}}function B_(i){if(a.controls){const e=!a.controls.isLocked&&a.isPlaying;if(a.controls.isLocked||e){const t=a.controls.getObject(),n=e?!1:a.moveForward,r=e?!1:a.moveBackward,s=e?!1:a.moveLeft,l=e?!1:a.moveRight,o=n||r||s||l;Xn.set(0,0,-1).applyQuaternion(a.camera.quaternion),Xn.y=0,Xn.normalize(),qn.set(1,0,0).applyQuaternion(a.camera.quaternion),qn.y=0,qn.normalize(),Vr||(Vr=document.getElementById("speedlines")),Wr||(Wr=document.getElementById("sprint-badge")),Vr&&(Vr.style.opacity="0"),Wr&&(Wr.style.display="none");const c=a.isHovering;!a.canJump&&a.isShiftDown&&a.hoverFuel>0&&a.hookState!=="PULLING"?a.isHovering=!0:a.isHovering=!1,a.isHovering?(a.hoverFuel-=i/d_,a.hoverFuel<0&&(a.hoverFuel=0,a.isHovering=!1),Yn.copy(t.position),Yn.y-=1.8,lr(Yn,2,!1),n&&($l.copy(Xn).negate(),Ln(Yn,1,$l)),r&&Ln(Yn,1,Xn),s&&Ln(Yn,1,qn),l&&(Jl.copy(qn).negate(),Ln(Yn,1,Jl))):(a.canJump||a.hookState==="PULLING")&&(a.hoverFuel+=i/f_,a.hoverFuel>1&&(a.hoverFuel=1)),a.isHovering!==c&&(Xr||(Xr=document.getElementById("hover-badge")),Xr&&(Xr.style.display=a.isHovering?"inline-block":"none"));const h=a.canJump&&a.hookState!=="PULLING"?p_:0;a.velocity.x-=a.velocity.x*h*i,a.velocity.z-=a.velocity.z*h*i;let u=Ii;if(a.hookState==="PULLING"&&a.hookIsEnemy)u=0;else if(a.hookState==="PULLING")u=Ii*m_;else if(a.isHovering&&a.velocity.y<=0)u=Ii*g_;else if(a.velocity.y>0)if(a.velocity.y>Wl)u=Ii*1;else{const L=a.velocity.y/Wl,R=L*L;u=Ii*(.2+.8*R)}else{const L=Math.abs(a.velocity.y),R=Math.min(1,L/b_);u=Ii*(.2+1.1*R)}a.velocity.y-=u*i,a.isHovering?a.velocity.y<Fl&&(a.velocity.y=Fl):a.hookState!=="PULLING"&&a.velocity.y<-144.32&&(a.velocity.y=-144.32),Gt.set(0,0,0),n&&Gt.add(Xn),r&&Gt.sub(Xn),l&&Gt.add(qn),s&&Gt.sub(qn),Gt.lengthSq()>0&&Gt.normalize();const d=jg;if(a.canJump){if(a.hookState!=="PULLING"&&o){const L=Gt.x*d,R=Gt.z*d;a.velocity.x+=(L-a.velocity.x)*Vl*i,a.velocity.z+=(R-a.velocity.z)*Vl*i}}else a.hookState!=="PULLING"&&(a.velocity.x-=a.velocity.x*Hl*i,a.velocity.z-=a.velocity.z*Hl*i,a.isHovering?(n||s||l||r)&&(a.velocity.x+=Gt.x*Hr*i,a.velocity.z+=Gt.z*Hr*i):((n||s||l)&&(a.velocity.x+=Gt.x*Hr*i,a.velocity.z+=Gt.z*Hr*i),r&&(a.velocity.x-=a.velocity.x*Bl*i,a.velocity.z-=a.velocity.z*Bl*i)));const p=t.position.x+a.velocity.x*i,g=t.position.z+a.velocity.z*i,v=t.position.y-Do,_=N_.set(p,t.position.y,t.position.z),m=O_.set(t.position.x,t.position.y,g),{colX:f,colZ:y,groundY:M}=F_(t.position,_,m,v);f?(a.velocity.x=0,a.hookState==="PULLING"&&kt()):t.position.x=p,y?(a.velocity.z=0,a.hookState==="PULLING"&&kt()):t.position.z=g,t.position.y+=a.velocity.y*i;const T=M+Do;t.position.y<T&&(a.velocity.y=0,t.position.y=T,a.canJump=!0)}}}const G_="modulepreload",z_=function(i){return"/"+i},Zl={},rh=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){document.getElementsByTagName("link");const l=document.querySelector("meta[property=csp-nonce]"),o=(l==null?void 0:l.nonce)||(l==null?void 0:l.getAttribute("nonce"));r=Promise.allSettled(t.map(c=>{if(c=z_(c),c in Zl)return;Zl[c]=!0;const h=c.endsWith(".css"),u=h?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${c}"]${u}`))return;const d=document.createElement("link");if(d.rel=h?"stylesheet":G_,h||(d.as="script"),d.crossOrigin="",d.href=c,o&&d.setAttribute("nonce",o),document.head.appendChild(d),h)return new Promise((p,g)=>{d.addEventListener("load",p),d.addEventListener("error",()=>g(new Error(`Unable to preload CSS for ${c}`)))})}))}function s(l){const o=new Event("vite:preloadError",{cancelable:!0});if(o.payload=l,window.dispatchEvent(o),!o.defaultPrevented)throw l}return r.then(l=>{for(const o of l||[])o.status==="rejected"&&s(o.reason);return e().catch(s)})};let ds=()=>{},sh=()=>{};function k_(i,e){ds=i,sh=e}const H_=new Bn,nn=new P,er=new P,Yr=new P,fo=new Bn,jr=new P,tr=new P,Ql=new P,Kr=new P,Ui=new P,oh=new gt(.035,.035,1,8);oh.rotateX(Math.PI/2);const V_=new Lt({color:43775,roughness:.3,metalness:.6}),ot={inputUsername:null,hostLobbyStatus:null,btnHostStart:null,joinErrorLog:null,pvpStats:null,btnJoinConnect:null,blocker:null,panelMain:null,score:null,kills:null,crosshair:null},jt={inputUsername:()=>ot.inputUsername||(ot.inputUsername=document.getElementById("input-username")),hostLobbyStatus:()=>ot.hostLobbyStatus||(ot.hostLobbyStatus=document.getElementById("host-lobby-status")),btnHostStart:()=>ot.btnHostStart||(ot.btnHostStart=document.getElementById("btn-host-start")),joinErrorLog:()=>ot.joinErrorLog||(ot.joinErrorLog=document.getElementById("join-error-log")),pvpStats:()=>ot.pvpStats||(ot.pvpStats=document.getElementById("pvp-stats")),btnJoinConnect:()=>ot.btnJoinConnect||(ot.btnJoinConnect=document.getElementById("btn-join-connect")),blocker:()=>ot.blocker||(ot.blocker=document.getElementById("blocker")),panelMain:()=>ot.panelMain||(ot.panelMain=document.getElementById("panel-main")),score:()=>ot.score||(ot.score=document.getElementById("score")),kills:()=>ot.kills||(ot.kills=document.getElementById("kills")),crosshair:()=>ot.crosshair||(ot.crosshair=document.getElementById("crosshair"))};let $r="Guest";async function ah(){const i={debug:2,host:"0.peerjs.com",port:443,path:"/",secure:!0,config:{iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"},{urls:"stun:stun.cloudflare.com:3478"}]}};try{const e=await fetch(`/api/turn?room=${a.roomCode||""}`);if(e.ok){const t=await e.json();if(t&&t.iceServers)return i.config.iceServers=t.iceServers,console.log("Successfully loaded Cloudflare TURN servers."),i}}catch(e){console.warn("Failed to fetch Cloudflare TURN servers, using fallback ICE servers:",e)}return i.config.iceServers.push({urls:"turn:openrelay.metered.ca:80",username:"openrelayproject",credential:"openrelayproject"},{urls:"turn:openrelay.metered.ca:443",username:"openrelayproject",credential:"openrelayproject"},{urls:"turn:openrelay.metered.ca:443?transport=tcp",username:"openrelayproject",credential:"openrelayproject"}),i}function lh(){const i=jt.inputUsername();return i&&$r==="Guest"&&(i.addEventListener("input",()=>{$r=i.value||"Guest"}),$r=i.value||"Guest"),$r}function oi(i,e=null){if(!a.isMultiplayer||a.connections.length===0)return;const t=a.connections.length;for(let n=0;n<t;n++){const r=a.connections[n];if(r.open&&r.peer!==e)try{r.send(i)}catch(s){console.error(`Error broadcasting packet of type ${i.type} to peer ${r.peer}:`,s);try{r.close()}catch{}}}}function $o(i,e=16724787,t=s_){!i||!i.mesh||(i.mesh.traverse(n=>{n.isMesh&&n.material&&n.material.color&&(n.userData.originalColor===void 0&&(n.userData.originalColor=n.material.color.getHex()),n.material.color.setHex(e))}),setTimeout(()=>{!i||!i.mesh||i.mesh.traverse(n=>{n.isMesh&&n.material&&n.material.color&&n.userData.originalColor!==void 0&&n.material.color.setHex(n.userData.originalColor)})},t))}let xt=null,ec=0;function W_(){const i="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let e="";for(let t=0;t<i_;t++)e+=i.charAt(Math.floor(Math.random()*i.length));return e}async function X_(i,e){a.isMultiplayer=!0,a.isHost=!0,a.roomCode=e.toUpperCase();const t=`testfps-room-${a.roomCode}`,n=document.getElementById("host-lobby-status");xt&&xt.destroy();const{Peer:r}=await rh(async()=>{const{Peer:l}=await import("./bundler-DrDBPFLh.js");return{Peer:l}},[]),s=await ah();xt=new r(t,s),a.peer=xt,xt.on("open",l=>{console.log("Host registered successfully on PeerJS with ID:",l),n&&(n.innerText="Waiting for players (1/5)...");const o=document.getElementById("btn-host-start");o&&(o.style.display="inline-block")}),xt.on("connection",l=>{ch(l)}),xt.on("error",l=>{console.error("Host peer error:",l),n&&(l.type==="unavailable-id"?n.innerText="Error: Code already in use! Please try again in 5 seconds.":n.innerText=`Error: ${l.type}`),Mn()})}async function q_(i,e){a.isMultiplayer=!0,a.isHost=!1,a.roomCode=e.toUpperCase();const t=document.getElementById("join-error-log");t&&(t.innerText="Connecting to server..."),xt&&xt.destroy();const{Peer:n}=await rh(async()=>{const{Peer:s}=await import("./bundler-DrDBPFLh.js");return{Peer:s}},[]),r=await ah();xt=new n(r),a.peer=xt,xt.on("open",s=>{console.log("Client registered with ID:",s),t&&(t.innerText=`Searching room ${a.roomCode}...`);const l=`testfps-room-${a.roomCode}`,o=xt.connect(l);ch(o)}),xt.on("error",s=>{console.error("Client peer error:",s),t&&(s.type==="peer-unavailable"?t.innerText="Error: Room not found! Please check the code.":t.innerText=`Error: ${s.type}`),Mn()})}function Mn(){a.isMultiplayer=!1,a.isHost=!1,a.isPlaying=!1,a.roomCode=null,a.kills=0,a.deaths=0;const i=jt.pvpStats();i&&(i.style.display="none"),a.connections.length>0&&a.connections.forEach(n=>n.close()),a.connections=[],xt&&(xt.destroy(),xt=null,a.peer=null),Object.keys(a.peers).forEach(n=>{hh(n)}),a.peers={},a.peerIds=[],kt();const e=jt.btnJoinConnect();e&&(e.innerText="Connect",e.style.background="",e.disabled=!1,e.removeAttribute("data-connected"));const t=jt.joinErrorLog();t&&(t.style.color="",t.innerText="")}function tc(i){const e=document.getElementById("join-error-log");e&&(e.style.color="#ff4757",e.innerText=i);const t=document.getElementById("btn-join-connect");t&&(t.innerText="Connect",t.style.background="",t.disabled=!1,t.removeAttribute("data-connected"))}function ch(i){let e=!1;const t=a.isHost?null:setTimeout(()=>{e||(console.warn("Connection timed out — WebRTC DataChannel never opened."),tc("Connection failed. Please check the code and try again."),Mn())},1e4),n=()=>{if(!a.connections.includes(i))if(e=!0,t&&clearTimeout(t),console.log("Direct WebRTC DataConnection open with peer:",i.peer),a.connections.push(i),a.isHost){const r=jt.hostLobbyStatus();r&&(r.innerText="Connected as Client. Waiting for host...");const s=jt.joinErrorLog();s&&(s.style.color="#00ff88",s.innerText=`Connected successfully to room: ${a.roomCode}`);const l=jt.btnJoinConnect();l&&(l.innerText="Join Game",l.style.background="linear-gradient(135deg, #2ed573, #26af5f)",l.disabled=!1,l.dataset.connected="true")}else{const r=document.getElementById("join-error-log");r&&(r.style.color="#00ff88",r.innerText="Successfully connected!");const s=document.getElementById("btn-join-connect");s&&(s.innerText="Join Game",s.style.background="linear-gradient(135deg, #2ed573, #26af5f)",s.disabled=!1,s.dataset.connected="true")}};i.open?n():i.on("open",n),i.on("data",r=>{Y_(i.peer,r)}),i.on("close",()=>{console.log("Connection closed for peer:",i.peer);const r=a.connections.indexOf(i);if(r>-1&&a.connections.splice(r,1),hh(i.peer),a.isHost){const s=jt.hostLobbyStatus(),l=a.connections.length+1;s&&(s.innerText=`Waiting for players (${l}/5)...`)}else{Mn(),a.controls&&a.controls.unlock();const s=jt.blocker();s&&(s.style.display="flex"),["panel-mp","panel-host-waiting","panel-join-room","panel-pause"].forEach(c=>{const h=document.getElementById(c);h&&(h.style.display="none")});const o=jt.panelMain();o&&(o.style.display="flex")}}),i.on("error",r=>{console.error("DataConnection error:",r),a.isHost||(tc(`Connection error: ${r.type||r.message||"unknown"}`),Mn())})}function Y_(i,e){var n;if(!a.isMultiplayer)return;a.isHost&&(e.type==="update"||e.type==="fire"||e.type==="player_hit"||e.type==="player_died"||e.type==="jump")&&(e.senderPeerId=i,oi(e,i));const t=e.senderPeerId||i;if(a.isPlaying){if(e.type==="update"){let r=a.peers[t],s=!1;if(!r){const l=e.username||"Guest";console.log(`Spawning remote peer bean model for: ${l}`),r=$_(l),a.peers[t]=r,a.peerIds=Object.keys(a.peers),s=!0}if(r.mesh.position.copy(e.pos),r.mesh.position.y-=r_,r.mesh.rotation.y=e.yaw,e.isDead?r.mesh.visible=!1:((s||r.mesh.visible===!1)&&(r.mesh.visible=!0,us(r.mesh.position)),e.isHovering&&(nn.copy(r.mesh.position),nn.y-=1.45,lr(nn,4,!1),e.hoverKeys&&(fo.set(0,e.yaw,0),er.set(0,0,-1).applyEuler(fo),Yr.set(1,0,0).applyEuler(fo),e.hoverKeys.w&&(er.negate(),Ln(nn,2,er),er.negate()),e.hoverKeys.s&&Ln(nn,2,er),e.hoverKeys.a&&Ln(nn,2,Yr),e.hoverKeys.d&&(Yr.negate(),Ln(nn,2,Yr))))),r.leftGun.rotation.x=e.pitch,r.rightGunContainer.rotation.x=e.pitch,r.pistolMesh.visible=e.activeWeapon==="PISTOL",r.shotgunMesh.visible=e.activeWeapon==="SHOTGUN",r.arMesh.visible=e.activeWeapon==="AR",r.sniperMesh.visible=e.activeWeapon==="SNIPER",r.minigunMesh.visible=e.activeWeapon==="MINIGUN",e.activeWeapon==="MINIGUN"&&r.minigunMesh&&r.minigunMesh.userData.barrels){r.minigunRamp===void 0&&(r.minigunRamp=0),r.lastUpdateTime===void 0&&(r.lastUpdateTime=performance.now());const l=performance.now(),o=Math.min((l-r.lastUpdateTime)/1e3,.1);r.lastUpdateTime=l,e.isMouseDown?r.minigunRamp=Math.min(3,r.minigunRamp+o):r.minigunRamp=Math.max(0,r.minigunRamp-o*2);const c=r.minigunRamp/3*40+(e.isMouseDown?5:0);r.minigunMesh.userData.barrels.rotation.z+=c*o}if(e.hookState!=="IDLE"&&e.hookPos){r.hookLine||(r.hookLine=new ce(oh,V_),r.hookLine.castShadow=!0,a.scene.add(r.hookLine)),r.leftGun.updateWorldMatrix(!0,!1),jr.copy(Ko),r.leftGun.localToWorld(jr),tr.set(e.hookPos.x,e.hookPos.y,e.hookPos.z);const l=jr.distanceTo(tr);l>.05&&(Ql.addVectors(jr,tr).multiplyScalar(.5),r.hookLine.position.copy(Ql),r.hookLine.scale.set(1,1,l),r.hookLine.lookAt(tr),r.hookLine.visible=!0)}else r.hookLine&&(r.hookLine.visible=!1)}else if(e.type==="fire")if(Kr.set(e.barrelPos.x,e.barrelPos.y,e.barrelPos.z),Ui.set(e.dir.x,e.dir.y,e.dir.z),e.weapon==="SNIPER"){const r=tr;e.hitPoint?r.set(e.hitPoint.x,e.hitPoint.y,e.hitPoint.z):r.copy(Kr).addScaledVector(Ui,500),ih(Kr,r,16776960)}else{let r;const s=((n=ls[e.weapon])==null?void 0:n.bulletColor)??16777215;a.projectilePool.length>0?(r=a.projectilePool.pop(),r.visible=!0,r.material.color.setHex(s)):(r=new ce(ys,new vt({color:s})),r.userData={}),r.position.copy(Kr).addScaledVector(Ui,.1),r.userData.dx=Ui.x,r.userData.dy=Ui.y,r.userData.dz=Ui.z,r.userData.age=0,a.scene.add(r),a.projectiles.push(r)}else if(e.type==="kill_target"){const r=a.targets[e.targetIndex];if(r){const s=e.color||16729344;Jt(r.position,s,35,30,.35,15),cr(r.position,8*(e.scale||1),16755200),r.position.set(e.newPosition.x,e.newPosition.y,e.newPosition.z),r.userData.maxHp=e.hp,r.userData.hp=e.hp,r.userData.scale=e.scale,r.userData.color=e.color,r.userData.bodyMesh.material.color.setHex(e.color),r.userData.bodyMesh.scale.set(e.scale,e.scale,e.scale),r.userData.healthBarFg.scale.x=1,r.userData.healthBarGroup.position.y=1.6*e.scale,r.userData.healthBarGroup.scale.set(e.scale,e.scale,1),a.score=e.score;const l=document.getElementById("score");l&&(l.innerText=a.score.toString())}}else if(e.type==="hit_target")a.isMultiplayer&&a.isHost&&ds(e.targetIndex,e.damage);else if(e.type==="player_hit"){const r=a.peers[e.targetPeerId];r&&$o(r,16724787,150),a.peer&&e.targetPeerId===a.peer.id&&sh(e.damage,e.attackerName)}else if(e.type==="player_died"){const r=a.peers[e.victimPeerId||t];r&&r.mesh&&(Jt(r.mesh.position,9206502,40,30,.4,18),r.mesh.visible=!1);const s=lh();if(e.killerName===s){a.kills++;const l=jt.kills();l&&(l.innerText=a.kills.toString());const o=jt.crosshair();o&&(o.style.borderColor="#00ff88",o.style.transform="translate(-50%, -50%) scale(1.5)",setTimeout(()=>{o.style.borderColor="#ff0055",o.style.transform="translate(-50%, -50%) scale(1.0)"},180))}}else if(e.type==="jump"){const r=a.peers[t];r&&r.mesh&&r.mesh.visible&&(nn.copy(r.mesh.position),nn.y-=1.45,lr(nn,50,!0),cr(nn,15))}}}function hh(i){const e=a.peers[i];e&&(e.mesh&&(a.scene.remove(e.mesh),e.mesh.traverse(t=>{var n,r,s;t.isMesh&&(t.geometry&&t.geometry!==ys&&t.geometry.dispose(),t.material&&t.material!==fr&&t.material.dispose()),t.isSprite&&((r=(n=t.material)==null?void 0:n.map)==null||r.dispose(),(s=t.material)==null||s.dispose())})),e.hookLine&&a.scene.remove(e.hookLine),delete a.peers[i],a.peerIds=Object.keys(a.peers),console.log(`Disposed remote peer mesh for: ${i}`))}function j_(){if(!a.isMultiplayer||!a.isPlaying||a.connections.length===0||!a.controls||!a.camera)return;const i=performance.now();if(i-ec<n_)return;ec=i;const e=a.controls.getObject(),t=H_.setFromQuaternion(a.camera.quaternion,"YXZ"),r={type:"update",username:lh(),pos:{x:e.position.x,y:e.position.y,z:e.position.z},yaw:t.y,pitch:t.x,activeWeapon:a.activeWeaponName,isMouseDown:a.isMouseDown,isDead:a.playerHp<=0,hookState:a.hookState,hookPos:a.hookState!=="IDLE"?{x:a.hookPosition.x,y:a.hookPosition.y,z:a.hookPosition.z}:null,isHovering:a.isHovering,hoverKeys:a.isHovering?{w:a.moveForward,s:a.moveBackward,a:a.moveLeft,d:a.moveRight}:null};oi(r)}function nc(i,e,t=null){if(!a.isMultiplayer||a.connections.length===0)return;const n={type:"fire",weapon:a.activeWeaponName,barrelPos:{x:i.x,y:i.y,z:i.z},dir:{x:e.x,y:e.y,z:e.z}};t&&(n.hitPoint={x:t.x,y:t.y,z:t.z}),oi(n)}function K_(i,e,t,n){if(!a.isMultiplayer||!a.isHost||a.connections.length===0)return;const r={type:"kill_target",targetIndex:i,score:e,newPosition:{x:t.x,y:t.y,z:t.z},scale:n.scale,hp:n.hp,color:n.color};oi(r)}function ic(){if(!a.isMultiplayer||a.connections.length===0)return;oi({type:"jump"})}function $_(i){if(!a.scene)throw new Error("Scene not initialized");const e=gh(9206502,16729943),t=fs(43775);t.position.set(-.7,0,-.5),e.add(t);const n=new yt;n.position.set(.7,0,-.5),e.add(n);const r=fs(16711765);n.add(r);const s=uh();s.visible=!1,n.add(s);const l=dh();l.visible=!1,n.add(l);const o=fh();o.visible=!1,n.add(o);const c=ph();c.visible=!1,n.add(c);const h=document.createElement("canvas");h.width=256,h.height=64;const u=h.getContext("2d");u&&(u.fillStyle="rgba(0, 0, 0, 0.5)",u.fillRect(0,0,256,64),u.font="bold 24px Segoe UI, Arial",u.fillStyle="#ffffff",u.textAlign="center",u.fillText(i,128,40));const d=new Wo({map:new dr(h),transparent:!0}),p=new Jc(d);return p.position.set(0,1.6,0),p.scale.set(3,.75,1),e.add(p),a.scene.add(e),e.scale.set(1.5,1.5,1.5),{mesh:e,leftGun:t,rightGunContainer:n,pistolMesh:r,shotgunMesh:s,arMesh:l,sniperMesh:o,minigunMesh:c,hookLine:null}}const J_=new P(.32,-.22,-.5),Z_=new P(.12,-.15,-.42),Q_=new P(-.32,-.22,-.5),e0=new P(-.32,-.65,-.45),rc=.6,t0=1,po=3.2,sc=3.8,ys=new vs(.07,8,8),fr=new Lt({color:3093826,roughness:.4});let Jr=null;const Zr=new Bn,mo=new P,go=new P,oc=new P,n0=new P,jn=new Qc,i0={PISTOL:"pistolMesh",SHOTGUN:"shotgunMesh",AR:"arMesh",SNIPER:"sniperMesh",MINIGUN:"minigunMesh"};function ac(i){const e=i0[i];return e?a[e]:null}const r0={PISTOL:.19,SHOTGUN:.22,AR:.26,SNIPER:.32,MINIGUN:.36};function lc(i){return r0[i]??.22}const fs=i=>{const e=new yt,t=new Xe(.07,.11,.38),n=fr,r=new ce(t,n);r.castShadow=!0,e.add(r);const s=new Xe(.05,.16,.07),l=new ce(s,n);l.position.set(0,-.09,.09),l.rotation.x=Math.PI/6,e.add(l);const o=new Xe(.03,.03,.36),c=new vt({color:i}),h=new ce(o,c);return h.position.set(0,.042,-.04),e.add(h),e},uh=()=>{const i=new yt,e=fr,t=new vt({color:16755200}),n=new Xe(.08,.12,.45),r=new ce(n,e);r.castShadow=!0,i.add(r);const s=new gt(.02,.02,.55,8);s.rotateX(Math.PI/2);const l=new ce(s,e);l.position.set(-.02,.02,-.3),l.castShadow=!0,i.add(l);const o=new ce(s,e);o.position.set(.02,.02,-.3),o.castShadow=!0,i.add(o);const c=new Xe(.06,.12,.22),h=new ce(c,e);h.position.set(0,-.09,.15),h.rotation.x=Math.PI/6,i.add(h);const u=new Xe(.09,.08,.25),d=new ce(u,e);d.position.set(0,-.04,-.15),i.add(d);const p=new Xe(.04,.04,.42),g=new ce(p,t);return g.position.set(0,.05,-.05),i.add(g),i},dh=()=>{const i=new yt,e=fr,t=new vt({color:65416}),n=new Xe(.08,.13,.52),r=new ce(n,e);r.castShadow=!0,i.add(r);const s=new gt(.015,.015,.65,8);s.rotateX(Math.PI/2);const l=new ce(s,e);l.position.set(0,.02,-.4),l.castShadow=!0,i.add(l);const o=new Xe(.05,.15,.07),c=new ce(o,e);c.position.set(0,-.1,.12),c.rotation.x=Math.PI/6,i.add(c);const h=new Xe(.04,.18,.08);h.rotateX(-Math.PI/12);const u=new ce(h,e);u.position.set(0,-.16,-.05),i.add(u);const d=new Xe(.04,.03,.48),p=new ce(d,t);return p.position.set(0,.052,-.06),i.add(p),i},fh=()=>{const i=new yt,e=fr,t=new vt({color:16771584}),n=new Lt({color:1976110,roughness:.2}),r=new Xe(.07,.11,.38),s=new ce(r,e);s.castShadow=!0,i.add(s);const l=new Xe(.05,.16,.07),o=new ce(l,e);o.position.set(0,-.09,.09),o.rotation.x=Math.PI/6,i.add(o);const c=new Xe(.03,.03,.36),h=new ce(c,t);h.position.set(0,.042,-.04),i.add(h);const u=new gt(.027,.027,1.14,8);u.rotateX(Math.PI/2);const d=new ce(u,e);d.position.set(0,0,-.76),d.castShadow=!0,i.add(d);const p=new Lt({color:1976110,roughness:.5,metalness:.8}),g=new vt({color:657938}),v=new gt(.038,.038,.14,8);v.rotateX(Math.PI/2);const _=new ce(v,p);_.position.set(0,0,-1.4),_.castShadow=!0,i.add(_);const m=new Xe(.01,.05,.025),f=new ce(m,g);f.position.set(-.036,0,-1.365),i.add(f);const y=new ce(m,g);y.position.set(-.036,0,-1.435),i.add(y);const M=new ce(m,g);M.position.set(.036,0,-1.365),i.add(M);const T=new ce(m,g);T.position.set(.036,0,-1.435),i.add(T);const L=new Xe(.05,.11,.32),R=new ce(L,e);R.position.set(0,-.04,.35),i.add(R);const C=new Xe(.052,.112,.02),V=new ce(C,t);V.position.set(0,-.04,.51),i.add(V);const S=new gt(.02,.02,.25,8);S.rotateX(Math.PI/2);const b=new ce(S,n);b.position.set(0,.09,-.05),b.castShadow=!0,i.add(b);const z=new Xe(.015,.04,.03),k=new ce(z,e);k.position.set(0,.065,.03),i.add(k);const Q=new ce(z,e);Q.position.set(0,.065,-.13),i.add(Q);const I=new gt(.018,.018,.01,8);I.rotateX(Math.PI/2);const N=new ce(I,t);return N.position.set(0,.09,-.176),i.add(N),i},ph=()=>{const i=new yt,e=new Lt({color:2899536,roughness:.5}),t=new Lt({color:1976110,roughness:.3,metalness:.8}),n=new Lt({color:3093826,roughness:.7}),r=-.06,s=.08,l=new Xe(.18,.18,.18),o=new ce(l,e);o.position.set(0,r,s),o.castShadow=!0,i.add(o);const c=new yt,h=new Xe(.04,.12,.04),u=new ce(h,n);u.position.set(0,r+.09,.07+s),u.castShadow=!0,c.add(u);const d=new gt(.02,.02,.15,8);d.rotateX(Math.PI/2);const p=new ce(d,n);p.position.set(0,r+.15,-.005+s),p.castShadow=!0,c.add(p),i.add(c);const g=new yt;g.position.set(0,r,s-.09);const v=.07,_=.72,m=new gt(.02,.02,_,8);m.rotateX(Math.PI/2);for(let M=0;M<6;M++){const T=M*Math.PI/3,L=new ce(m,t);L.position.set(Math.cos(T)*v,Math.sin(T)*v,-_/2),L.castShadow=!0,g.add(L)}const f=new Xe(.18,.18,.015),y=new ce(f,e);return y.position.set(0,0,-_/2),g.add(y),i.add(g),i.userData.barrels=g,i};function s0(){!a.camera||!a.scene||(a.leftGun=fs(43775),a.leftGun.position.set(-.32,-.22,-.5),a.camera.add(a.leftGun),a.rightGunContainer=new yt,a.rightGunContainer.position.set(.32,-.22,-.5),a.camera.add(a.rightGunContainer),a.pistolMesh=fs(16711765),a.rightGunContainer.add(a.pistolMesh),a.shotgunMesh=uh(),a.shotgunMesh.visible=!1,a.rightGunContainer.add(a.shotgunMesh),a.arMesh=dh(),a.arMesh.visible=!1,a.rightGunContainer.add(a.arMesh),a.sniperMesh=fh(),a.sniperMesh.visible=!1,a.rightGunContainer.add(a.sniperMesh),a.minigunMesh=ph(),a.minigunMesh.visible=!1,a.rightGunContainer.add(a.minigunMesh),a.rightGun=a.pistolMesh,a.scene.add(a.camera))}function mh(){if(!a.scene||!a.camera||!a.rightGunContainer||!a.rightGun||a.activeWeaponName==="MINIGUN"&&a.minigunRamp<E_)return;const i=ls[a.activeWeaponName];if(!i)return;a.rightGunContainer.position.z+=i.recoil;const e=n=>{let r;const s=i.bulletColor;if(a.projectilePool.length>0)r=a.projectilePool.pop(),r.visible=!0,r.material.color.setHex(s);else{const c=new vt({color:s});r=new ce(ys,c),r.userData={}}a.scene.add(r);const l=mo;a.rightGun.getWorldPosition(l);const o=go;a.camera.getWorldDirection(o),n>0&&(oc.set((Math.random()-.5)*n,(Math.random()-.5)*n,(Math.random()-.5)*n),o.add(oc).normalize()),r.position.copy(l).addScaledVector(o,.1),r.userData.dx=o.x,r.userData.dy=o.y,r.userData.dz=o.z,r.userData.age=0,a.projectiles.push(r)};let t=i.fireRate;if(a.activeWeaponName==="MINIGUN"){const n=a.minigunRamp/Io;t=60/(kl+(T_-kl)*n)}if(a.fireCooldown=t,a.activeWeaponName==="SNIPER"){const n=mo;a.rightGun.getWorldPosition(n);const r=go;a.camera.getWorldDirection(r),jn.set(a.camera.position,r),jn.far=500,jn.camera=a.camera;const s=jn.intersectObjects(a.obstacles);let l=1/0;s.length>0&&(l=s[0].distance);let o=-1,c=1/0,h=null;const u=a.targets.length;for(let v=0;v<u;v++){const _=a.targets[v],m=_.userData.bodyMesh;if(m){const f=jn.intersectObject(m);if(f.length>0){const y=f[0].distance;y<c&&(c=y,o=v,h=_)}}}let d=null,p=1/0;if(a.isMultiplayer){const v=Object.keys(a.peers),_=v.length;for(let m=0;m<_;m++){const f=v[m],y=a.peers[f];if(y&&y.mesh){const M=jn.intersectObject(y.mesh,!0);if(M.length>0){const T=M[0].distance;T<p&&(p=T,d=f)}}}}jn.far=1/0;const g=n0.copy(a.camera.position).addScaledVector(r,300);if(l<c&&l<p)g.copy(a.camera.position).addScaledVector(r,l),Jt(g,13424096,6,8,.1,8);else if(o!==-1&&c<p&&h)g.copy(a.camera.position).addScaledVector(r,c),a.isMultiplayer?a.isHost?ds(o,i.damage):oi({type:"hit_target",targetIndex:o,damage:i.damage}):ds(o,i.damage),Jt(g,h.userData.color||16755200,15,12,.15,12);else if(d!==null){g.copy(a.camera.position).addScaledVector(r,p);const v=a.peers[d];v&&$o(v,16724787,150),Jr||(Jr=document.getElementById("input-username"));const _=Jr&&Jr.value.trim()||"Guest";oi({type:"player_hit",targetPeerId:d,damage:i.damage,attackerName:_}),Jt(g,9206502,15,12,.15,12)}ih(n,g,i.bulletColor),a.isMultiplayer&&nc(n,r,g);return}else if(a.activeWeaponName==="SHOTGUN"){const n=i.pellets||5;for(let r=0;r<n;r++)e(i.spread)}else e(i.spread);if(a.isMultiplayer){const n=mo;a.rightGun.getWorldPosition(n);const r=go;a.camera.getWorldDirection(r),nc(n,r)}}function o0(i){if(a.fireCooldown>0&&(a.fireCooldown-=i),a.rightGunContainer&&(a.rightGunContainer.position.z+=(-.5-a.rightGunContainer.position.z)*15*i),a.leftGun&&a.inspectState==="IDLE"&&!a.isThirdPerson&&Math.abs(a.leftGun.position.z- -.5)>.001&&(a.leftGun.position.z+=(-.5-a.leftGun.position.z)*15*i),a.activeWeaponName==="MINIGUN"){if(a.controls&&a.controls.isLocked&&a.isMouseDown&&a.switchState==="IDLE"?a.minigunRamp=Math.min(Io,a.minigunRamp+i):a.minigunRamp=Math.max(0,a.minigunRamp-i*2),a.minigunMesh&&a.minigunMesh.userData.barrels){const e=a.controls?a.controls.isLocked:!1,t=a.minigunRamp/Io*40+(a.isMouseDown&&e&&a.switchState==="IDLE"?5:0);a.minigunMesh.userData.barrels.rotation.z+=t*i}}else a.minigunRamp=Math.max(0,a.minigunRamp-i*2);if(a.switchState==="IDLE"&&a.activeWeaponName!==a.desiredWeaponName&&(a.nextWeaponName=a.desiredWeaponName,a.switchState="WITHDRAWING",a.switchTimer=0),a.switchState!=="IDLE"&&a.pistolMesh&&a.shotgunMesh&&a.arMesh&&a.sniperMesh&&a.minigunMesh){a.switchTimer+=i;const e=Math.min(1,a.switchTimer/$g),t=ac(a.activeWeaponName),n=ac(a.nextWeaponName),r=lc(a.activeWeaponName);if(a.switchState==="WITHDRAWING"&&t&&n){const s=e*(Math.PI/1.7);if(t.rotation.x=s,t.position.y=-r*Math.sin(Math.abs(s)),t.position.z=r*(Math.cos(s)-1),e>=1){t.visible=!1,t.rotation.set(0,0,0),t.position.set(0,0,0),a.activeWeaponName=a.nextWeaponName,a.rightGun=n;const l=lc(a.activeWeaponName),o=-Math.PI/1.7;n.visible=!0,n.rotation.x=o,n.position.y=-l*Math.sin(Math.abs(o)),n.position.z=l*(Math.cos(o)-1),a.switchState="BRINGING_IN",a.switchTimer=0}}else if(a.switchState==="BRINGING_IN"&&n){const s=-Math.PI/1.7*(1-e);n.rotation.x=s,n.position.y=-r*Math.sin(Math.abs(s)),n.position.z=r*(Math.cos(s)-1),e>=1&&(n.rotation.set(0,0,0),n.position.set(0,0,0),a.switchState="IDLE")}}if(a.playerMesh&&a.controls&&a.camera){const e=a.controls.getObject();a.playerMesh.position.copy(e.position),a.playerMesh.position.y-=.35,Zr.setFromQuaternion(a.camera.quaternion,"YXZ"),a.playerMesh.rotation.y=Zr.y,a.isThirdPerson?(a.leftGun&&(a.leftGun.rotation.x=Zr.x),a.rightGunContainer&&(a.rightGunContainer.rotation.x=Zr.x)):(a.leftGun&&a.leftGun.rotation.set(0,0,0),a.rightGunContainer&&a.rightGunContainer.rotation.set(0,0,0))}if(a.inspectState==="INSPECTING"){if(a.inspectTimer+=i,a.inspectTimer>=sc)a.inspectState="IDLE",a.inspectTimer=0,a.rightGunContainer&&!a.isThirdPerson&&(a.rightGunContainer.position.set(.32,-.22,-.5),a.rightGunContainer.rotation.set(0,0,0)),a.leftGun&&!a.isThirdPerson&&(a.leftGun.position.set(-.32,-.22,-.5),a.leftGun.rotation.set(0,0,0));else if(!a.isThirdPerson){const e=a.inspectTimer,t=J_,n=Z_,r=Q_,s=e0,l=0,o=83*Math.PI/180,c=0,h=Math.PI/2;if(e<rc){const u=e/rc,d=.5-.5*Math.cos(u*Math.PI);a.rightGunContainer&&(a.rightGunContainer.position.lerpVectors(t,n,d),a.rightGunContainer.rotation.set(l*d,o*d,c*d)),a.leftGun&&(a.leftGun.position.lerpVectors(r,s,d),a.leftGun.rotation.set(h*d,0,0))}else if(e<t0)a.rightGunContainer&&(a.rightGunContainer.position.copy(n),a.rightGunContainer.rotation.set(l,o,c)),a.leftGun&&(a.leftGun.position.copy(s),a.leftGun.rotation.set(h,0,0));else if(e<po){a.rightGunContainer&&a.rightGunContainer.position.copy(n),a.leftGun&&(a.leftGun.position.copy(s),a.leftGun.rotation.set(h,0,0));const u=e-1,d=Math.PI/2.2;let p=0;if(u<.4){const g=u/.4;p=(.5-.5*Math.cos(g*Math.PI))*d}else if(u<.8)p=d;else if(u<1.4){const g=(u-.8)/.6,v=.5-.5*Math.cos(g*Math.PI);p=d-v*(2*d)}else if(u<1.8)p=-d;else{const g=(u-1.8)/.4,v=.5-.5*Math.cos(g*Math.PI);p=-d+v*d}a.rightGunContainer&&a.rightGunContainer.rotation.set(l,o,p)}else{const u=(e-po)/(sc-po),d=.5-.5*Math.cos(u*Math.PI);a.rightGunContainer&&(a.rightGunContainer.position.lerpVectors(n,t,d),a.rightGunContainer.rotation.set(l*(1-d),o*(1-d),c*(1-d))),a.leftGun&&(a.leftGun.position.lerpVectors(s,r,d),a.leftGun.rotation.set(h*(1-d),0,0))}}}}function zt(){a.inspectState==="INSPECTING"&&(a.inspectState="IDLE",a.inspectTimer=0,a.rightGunContainer&&!a.isThirdPerson&&(a.rightGunContainer.position.set(.32,-.22,-.5),a.rightGunContainer.rotation.set(0,0,0)),a.leftGun&&!a.isThirdPerson&&(a.leftGun.position.set(-.32,-.22,-.5),a.leftGun.rotation.set(0,0,0)))}function gh(i,e){const t=new yt,n=new Lt({color:i,roughness:.3,metalness:.2}),r=new gt(.6,.6,1,16),s=new ce(r,n);s.castShadow=!0,s.receiveShadow=!0,t.add(s);const l=new vs(.6,16,16),o=new ce(l,n);o.position.y=.5,o.castShadow=!0,o.receiveShadow=!0,t.add(o);const c=new Lt({color:12632256,roughness:.15,metalness:.85}),h=new gt(.6,.6,.4,16),u=new ce(h,c);u.position.y=-.7,u.castShadow=!0,u.receiveShadow=!0,t.add(u);const d=new gt(.4,.2,.2,16),p=new ce(d,c);p.position.y=-1,p.castShadow=!0,p.receiveShadow=!0,t.add(p);const g=new Xe(.85,.25,.45),v=new Lt({color:1976110,roughness:.1,metalness:.9}),_=new ce(g,v);_.position.set(0,.5,-.35),_.castShadow=!0,_.receiveShadow=!0,t.add(_);const m=new Xe(.5,.05,.47),f=new vt({color:e}),y=new ce(m,f);return y.position.set(0,.5,-.36),t.add(y),t}function a0(){a.scene&&(a.playerMesh=gh(3889560,65484),a.playerMesh.scale.set(1.5,1.5,1.5),a.playerMesh.visible=!1,a.scene.add(a.playerMesh))}function l0(i){a.isThirdPerson=i,i?(a.playerMesh&&(a.playerMesh.visible=!0),a.playerMesh&&a.leftGun&&a.rightGunContainer&&(a.playerMesh.add(a.leftGun),a.playerMesh.add(a.rightGunContainer),a.leftGun.position.set(-.7,0,-.5),a.rightGunContainer.position.set(.7,0,-.5))):(a.playerMesh&&(a.playerMesh.visible=!1),a.camera&&a.leftGun&&a.rightGunContainer&&(a.camera.add(a.leftGun),a.camera.add(a.rightGunContainer),a.leftGun.position.set(-.32,-.22,-.5),a.rightGunContainer.position.set(.32,-.22,-.5)))}function _h(i){i.position.x=(Math.random()-.5)*(an-40),i.position.y=3+Math.random()*(Kg-5),i.position.z=(Math.random()-.5)*(an-40);const e=Il[Math.floor(Math.random()*Il.length)];i.userData.maxHp=e.hp,i.userData.hp=e.hp,i.userData.scale=e.scale,i.userData.color=e.color,i.userData.bodyMesh.material.color.setHex(e.color),i.userData.bodyMesh.scale.set(e.scale,e.scale,e.scale),i.userData.healthBarGroup.position.y=1.6*e.scale,i.userData.healthBarGroup.scale.set(e.scale,e.scale,1),i.userData.healthBarFg.scale.x=1}function ps(i,e,t,n,r){const s=n.length;for(let l=0;l<s;l++){const o=n[l],c=Math.abs(i-o.position.x),h=Math.abs(e-o.position.z);if(c<r+t&&h<r+t)return!0}return!1}function cc(i,e){return ps(i,e,Yt/2,a.obstacles,on)}function c0(){const e=document.createElement("canvas");e.width=512,e.height=512;const t=e.getContext("2d");t.fillStyle="#1e4620",t.fillRect(0,0,512,512);for(let r=0;r<5e3;r++){const s=Math.random()*512,l=Math.random()*512,o=2+Math.random()*5,c=-Math.PI/2+(Math.random()-.5)*.5,h=90+Math.random()*25,u=45+Math.random()*15,d=22+Math.random()*18;t.strokeStyle=`hsl(${h}, ${u}%, ${d}%)`,t.lineWidth=1.5+Math.random()*2,t.beginPath(),t.moveTo(s,l),t.lineTo(s+Math.cos(c)*o,l+Math.sin(c)*o),t.stroke()}const n=new dr(e);return n.wrapS=ni,n.wrapT=ni,n.repeat.set(250,250),n}function h0(){const e=document.createElement("canvas");e.width=512,e.height=512;const t=e.getContext("2d");t.fillStyle="#3a2312",t.fillRect(0,0,512,512);for(let r=0;r<4e3;r++){const s=Math.random()*512,l=Math.random()*512,o=40+Math.random()*120,c=22+Math.random()*8,h=25+Math.random()*15,u=12+Math.random()*15;t.strokeStyle=`hsl(${c}, ${h}%, ${u}%)`,t.lineWidth=1.5+Math.random()*3.5,t.beginPath(),t.moveTo(s,l);const d=(Math.random()-.5)*2;t.lineTo(s+d,l+o),t.stroke()}t.strokeStyle="#1a0d05";for(let r=0;r<40;r++){let s=Math.random()*512;t.lineWidth=2+Math.random()*4,t.beginPath(),t.moveTo(s,0);for(let l=0;l<512;l+=20)s+=(Math.random()-.5)*4,t.lineTo(s,l);t.stroke()}const n=new dr(e);return n.wrapS=ni,n.wrapT=ni,n.repeat.set(1,4),n}function u0(){const e=document.createElement("canvas");e.width=512,e.height=512;const t=e.getContext("2d"),n=512/2,r=512/2;t.fillStyle="#e4c49f",t.fillRect(0,0,512,512);const s=512*.75,l=6+Math.random()*4;for(let h=10;h<s;h+=l){const u=25+Math.random()*8,d=30+Math.random()*15,p=35+Math.random()*10;t.strokeStyle=`hsl(${u}, ${d}%, ${p}%)`,t.lineWidth=1+Math.random()*1.5,t.beginPath();const g=120;for(let v=0;v<=g;v++){const _=v/g*Math.PI*2,f=Math.sin(_*6)*3+Math.cos(_*3)*2+Math.sin(_*12)*.8+(Math.random()-.5)*.5,y=h+f,M=n+Math.cos(_)*y,T=r+Math.sin(_)*y;v===0?t.moveTo(M,T):t.lineTo(M,T)}t.stroke()}t.fillStyle="rgba(150, 110, 80, 0.08)";for(let h=0;h<5e3;h++){const u=Math.random()*Math.PI*2,d=Math.random()*s,p=n+Math.cos(u)*d,g=r+Math.sin(u)*d;t.fillRect(p,g,1.5,1.5)}const o=3+Math.floor(Math.random()*3);t.strokeStyle="rgba(65, 40, 20, 0.85)";for(let h=0;h<o;h++){const u=Math.random()*Math.PI*2,d=15+Math.random()*30,p=s*(.6+Math.random()*.4);t.lineWidth=1.5+Math.random()*2,t.beginPath();let g=n+Math.cos(u)*d,v=r+Math.sin(u)*d;t.moveTo(g,v);const _=15;for(let m=1;m<=_;m++){const f=m/_,y=d+f*(p-d),M=u+(Math.random()-.5)*.15;g=n+Math.cos(M)*y,v=r+Math.sin(M)*y,t.lineTo(g,v)}t.stroke()}return t.fillStyle="#412814",t.beginPath(),t.arc(n,r,3+Math.random()*4,0,Math.PI*2),t.fill(),new dr(e)}const d0=new gt(.15,.25,1,5),f0=new qo(1,0),p0=new Ms({color:5913896,flatShading:!0});function m0(){const i=new yt,e=[3106355,4028994,4951633,2247717,3962945],t=e[Math.floor(Math.random()*e.length)],n=new Ms({color:t,flatShading:!0}),r=new ce(d0,p0);r.position.y=.5,r.castShadow=!0,r.receiveShadow=!0,i.add(r);const s=3+Math.floor(Math.random()*3);for(let l=0;l<s;l++){const o=.7+Math.random()*.7,c=new ce(f0,n);c.scale.setScalar(o);const h=(Math.random()-.5)*1,u=.7+Math.random()*.9,d=(Math.random()-.5)*1;c.position.set(h,u,d),c.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI),c.castShadow=!0,c.receiveShadow=!0,i.add(c)}return i}function g0(i){const t=document.createElement("canvas");t.width=256,t.height=256;const n=t.getContext("2d");n.clearRect(0,0,256,256);const r=256/2,s=256*.9;function l(c,h,u,d){let p=d;typeof p=="number"&&(p="#"+p.toString(16).padStart(6,"0"));const g=parseInt(p.slice(1,3),16),v=parseInt(p.slice(3,5),16),_=parseInt(p.slice(5,7),16),m=6+Math.floor(Math.random()*3),f=[];for(let L=0;L<m;L++){const R=L/m*Math.PI*2+(Math.random()-.5)*.1,C=u*(.85+Math.random()*.3);f.push({x:c+Math.cos(R)*C,y:h+Math.sin(R)*C})}const y=(Math.random()-.3)*(u*.25),M=-u*.15+(Math.random()-.5)*(u*.15),T={x:c+y,y:h+M};for(let L=0;L<m;L++){const R=f[L],C=f[(L+1)%m],V=(R.x+C.x)/2,S=(R.y+C.y)/2,b=Math.atan2(S-h,V-c),k=.95+Math.cos(b- -Math.PI/4)*.25,Q=Math.min(255,Math.max(0,Math.round(g*k))),I=Math.min(255,Math.max(0,Math.round(v*k))),N=Math.min(255,Math.max(0,Math.round(_*k))),W=`rgb(${Q}, ${I}, ${N})`;n.fillStyle=W,n.strokeStyle=W,n.lineWidth=1,n.beginPath(),n.moveTo(T.x,T.y),n.lineTo(R.x,R.y),n.lineTo(C.x,C.y),n.closePath(),n.fill(),n.stroke()}}return l(r-30,s-35,45,i),l(r+30,s-35,45,i),l(r,s-80,50,i),l(r-10,s-110,38,i),l(r+15,s-105,35,i),new dr(t)}function _0(i,e,t){return!!(ps(i,e,t,a.obstacles,Yt/2)||ps(i,e,t,a.lavaPools,on)||i*i+e*e<625)}function v0(i,e,t){return a.fakePillars?ps(i,e,t,a.fakePillars,Yt*1.5/2):!1}function M0(){const i=new si(Xl,Xl),e=c0(),t=new Ms({map:e,color:16777215}),n=new ce(i,t);n.rotation.x=-Math.PI/2,n.receiveShadow=!0,a.scene.add(n),a.grappleSurfaces.push(n)}function x0(){a.fakePillars=[];const i=new si(Yt*1.5,1),e=new Ms({color:4731428,side:It});for(let r=0;r<120;r++){const s=Math.random()*Math.PI*2,l=an/2+20+Math.random()*1100,o=Math.cos(s)*l,c=Math.sin(s)*l,h=20+Math.random()*(eh-20),u=new ce(i,e);u.scale.set(1,h,1),u.position.set(o,h/2,c),a.scene.add(u),a.fakePillars.push(u)}const t=new Xe(on*2,.15,on*2),n=new vt({color:16726784});for(let r=0;r<80;r++){const s=Math.random()*Math.PI*2,l=an/2+20+Math.random()*1100,o=Math.cos(s)*l,c=Math.sin(s)*l,h=new ce(t,n);h.position.set(o,.075,c),a.scene.add(h)}}function y0(){const i=new _t,e=new Xe(Yt,1,Yt),t=h0(),n=u0(),r=new Lt({map:t,roughness:.9,metalness:.1}),s=new Lt({map:n,roughness:.8,metalness:.1}),l=[r,r,s,s,r,r],o=new Og(e,l,Ll);o.castShadow=!0,o.receiveShadow=!0;const c=new vt,h=new Xe(1,1,1);for(let u=0;u<Ll;u++){const d=20+Math.random()*(eh-20);i.scale.set(1,d,1),i.position.set((Math.random()-.5)*(an-40),d/2,(Math.random()-.5)*(an-40)),i.updateMatrix(),o.setMatrixAt(u,i.matrix);const p=new ce(h,c);p.scale.set(Yt,d,Yt),p.position.copy(i.position),p.userData.height=d,p.userData.halfW=Yt/2,p.userData.halfD=Yt/2,p.userData.halfH=d/2,p.visible=!1,a.scene.add(p),a.obstacles.push(p),a.grappleSurfaces.push(p)}a.scene.add(o)}function S0(){const i=new Xe(on*2,.15,on*2),e=new Lt({color:16729344,emissive:16720384,emissiveIntensity:1.5,roughness:.5});for(let t=0;t<30;t++){let n=!1,r=[],s=0;for(;!n&&s<100;){s++,r=[];let l=0,o=0,c=0;do l=(Math.random()-.5)*(an-80),o=(Math.random()-.5)*(an-80),c++;while((Math.sqrt(l*l+o*o)<30||cc(l,o))&&c<50);if(c>=50)continue;r.push({x:l,z:o});const h=1+Math.floor(Math.random()*5);let u=!0;for(let d=1;d<h;d++){let p=!1,g=0;for(;!p&&g<30;){g++;const v=r[Math.floor(Math.random()*r.length)],_=Math.floor(Math.random()*4);let m=v.x,f=v.z;const y=on*2;_===0?m+=y:_===1?m-=y:_===2?f+=y:f-=y,!r.some(T=>Math.abs(T.x-m)<1&&Math.abs(T.z-f)<1)&&(Math.abs(m)>an/2-on-10||Math.abs(f)>an/2-on-10||Math.sqrt(m*m+f*f)<30||cc(m,f)||(r.push({x:m,z:f}),p=!0))}if(!p){u=!1;break}}u&&(n=!0)}if(n){const l=r.length;for(let o=0;o<l;o++){const c=r[o],h=new ce(i,e);h.position.set(c.x,.075,c.z),a.scene.add(h),a.lavaPools.push(h),a.grappleSurfaces.push(h)}}}}function E0(){let i=0,e=0;for(;i<l_&&e<1e3;){e++;const o=Math.random()*Math.PI*2,c=Math.random()*c_,h=Math.cos(o)*c,u=Math.sin(o)*c;if(!_0(h,u,3.5)){const d=m0(),p=.75+Math.random()*.5;d.scale.set(p,p,p),d.position.set(h,0,u),a.scene.add(d),i++}}const r=[1388568,1717020,1453080,991248,1255445].map(o=>g0(o)).map(o=>new Wo({map:o,transparent:!0,color:16777215}));let s=0,l=0;for(;s<a_&&l<1500;){l++;const o=Math.random()*Math.PI*2,c=h_+Math.random()*u_,h=Math.cos(o)*c,u=Math.sin(o)*c;if(!v0(h,u,3.5)){const d=r[Math.floor(Math.random()*r.length)],p=new Jc(d),g=4+Math.random()*2,v=g*(.8+Math.random()*.3);p.scale.set(v,g,1),p.position.set(h,g/2,u),a.scene.add(p),s++}}}function T0(){const i=new Xe(2,2,2),e=new Lt({roughness:.2}),t=new si(1.8,.15),n=new vt({color:3355443,side:It}),r=new si(1.8,.15).translate(.9,0,0),s=new vt({color:65484,side:It});for(let l=0;l<16;l++){const o=new yt,c=new ce(i,e.clone());c.castShadow=!0,c.receiveShadow=!0,o.add(c),o.userData.bodyMesh=c;const h=new yt;h.position.y=1.6;const u=new ce(t,n);h.add(u);const d=new ce(r,s);d.position.set(-.9,0,.01),h.add(d),o.add(h),o.userData.healthBarFg=d,o.userData.healthBarBg=u,o.userData.healthBarGroup=h,_h(o),a.scene.add(o),a.targets.push(o)}}function b0(){a.scene&&(M0(),x0(),y0(),S0(),E0(),T0())}function A0(i){const e=a.targets.length;for(let t=0;t<e;t++){const n=a.targets[t];n.userData.bodyMesh.rotation.x+=1*i,n.userData.bodyMesh.rotation.y+=1.5*i,a.camera&&n.userData.healthBarGroup.quaternion.copy(a.camera.quaternion)}if(a.fakePillars&&a.controls){const t=a.controls.getObject(),n=t.position.x,r=t.position.z,s=a.fakePillars.length;for(let l=0;l<s;l++){const o=a.fakePillars[l];o.lookAt(n,o.position.y,r)}}}const w0=new P,hc=new P,_o=new P,vh=new P,Rn=new P,uc={},we=i=>uc[i]||(uc[i]=document.getElementById(i)),w={get healthBar(){return we("health-bar")},get hoverBar(){return we("hover-bar")},get fpsCounter(){return we("fps-counter")},get reloadBar(){return we("reload-bar")},get gogglesScope(){return we("goggles-scope")},get crosshair(){return we("crosshair")},get ui(){return we("ui")},get healthContainer(){return we("health-container")},get reloadContainer(){return we("reload-container")},get hoverContainer(){return we("hover-container")},get pvpStats(){return we("pvp-stats")},get score(){return we("score")},get deaths(){return we("deaths")},get blocker(){return we("blocker")},get deathOverlay(){return we("death-overlay")},get hoverBadge(){return we("hover-badge")},get worldBorderOverlay(){return we("world-border-overlay")},get inputUsername(){return we("input-username")},get sensSlider(){return we("sensitivity")},get sensValue(){return we("sens-value")},get panelMain(){return we("panel-main")},get panelMp(){return we("panel-mp")},get panelHostWaiting(){return we("panel-host-waiting")},get panelJoinRoom(){return we("panel-join-room")},get panelPause(){return we("panel-pause")},get btnPlaySp(){return we("btn-play-sp")},get btnMenuMp(){return we("btn-menu-mp")},get btnMpBack(){return we("btn-mp-back")},get btnMpHostView(){return we("btn-mp-host-view")},get btnMpJoinView(){return we("btn-mp-join-view")},get btnHostCancel(){return we("btn-host-cancel")},get btnHostStart(){return we("btn-host-start")},get btnJoinConnect(){return we("btn-join-connect")},get btnJoinCancel(){return we("btn-join-cancel")},get btnPauseResume(){return we("btn-pause-resume")},get btnPauseLeave(){return we("btn-pause-leave")},get inputRoomCode(){return we("input-room-code")},get roomCodeDisplay(){return we("room-code-display")},get joinErrorLog(){return we("join-error-log")},get pauseLobbyInfo(){return we("pause-lobby-info")},get pauseRoomCode(){return we("pause-room-code")},get btnDeathRespawn(){return we("btn-death-respawn")},get btnDeathLeave(){return we("btn-death-leave")},get mpNameError(){return we("mp-name-error")},get btnCopyCode(){return we("btn-copy-code")}},vo=["PISTOL","SHOTGUN","AR","SNIPER","MINIGUN"];let dc=-1,fc=-1,pc=-1,mc=null;function Ss(i,e=null){w.healthBar&&(w.healthBar.style.width=`${i}%`,e?(w.healthBar.style.backgroundColor=e,setTimeout(()=>{a.playerHp>0&&w.healthBar&&w.healthBar.style.backgroundColor===e&&(w.healthBar.style.backgroundColor="#2ed573")},100)):w.healthBar.style.backgroundColor="#2ed573")}function R0(i){w.hoverBar&&i!==fc&&(w.hoverBar.style.height=`${i*100}%`,fc=i)}let Mo=0,xo=performance.now();function gc(i){return i?i.length>10?"Username must be 10 characters or less!":/^[A-Za-z]+$/.test(i)?null:"Username must contain letters only!":"Username cannot be empty!"}function C0(){a.camera&&a.renderer&&(a.camera.aspect=window.innerWidth/window.innerHeight,a.camera.updateProjectionMatrix(),a.renderer.setSize(window.innerWidth,window.innerHeight))}function P0(){a.camera=new qt(as,window.innerWidth/window.innerHeight,.1,1500),a.scene=new Ig,a.scene.background=new We(13687792),a.scene.fog=new Vo(13687792,.002);const i=new zg(7829367);a.scene.add(i);const e=new Gg(16777215,1.2);e.position.set(200,400,200),e.castShadow=!0,e.shadow.mapSize.width=1024,e.shadow.mapSize.height=1024,e.shadow.camera.near=.5,e.shadow.camera.far=1200;const t=450;e.shadow.camera.left=-t,e.shadow.camera.right=t,e.shadow.camera.top=t,e.shadow.camera.bottom=-t,e.shadow.bias=-5e-4,a.scene.add(e),a.renderer=new Kc({antialias:!0}),a.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)),a.renderer.setSize(window.innerWidth,window.innerHeight),a.renderer.shadowMap.enabled=!0,a.renderer.shadowMap.type=Mc,document.body.appendChild(a.renderer.domElement),a.controls=new Wg(a.camera,document.body)}function L0(){w.btnPlaySp&&w.btnPlaySp.addEventListener("click",i=>{i.stopPropagation(),a.isMultiplayer=!1,a.isHost=!1,a.pendingPlay=!0,a.controls&&a.controls.lock()}),w.btnMenuMp&&w.btnMenuMp.addEventListener("click",i=>{i.stopPropagation(),w.panelMain&&(w.panelMain.style.display="none"),w.panelMp&&(w.panelMp.style.display="flex")}),w.btnMpBack&&w.btnMpBack.addEventListener("click",i=>{i.stopPropagation(),w.mpNameError&&(w.mpNameError.innerText=""),w.panelMp&&(w.panelMp.style.display="none"),w.panelMain&&(w.panelMain.style.display="flex")}),w.btnMpHostView&&w.btnMpHostView.addEventListener("click",i=>{i.stopPropagation();const e=w.inputUsername?w.inputUsername.value.trim():"Guest",t=gc(e);if(t){w.mpNameError&&(w.mpNameError.innerText=t);return}w.mpNameError&&(w.mpNameError.innerText=""),w.panelMp&&(w.panelMp.style.display="none"),w.panelHostWaiting&&(w.panelHostWaiting.style.display="flex");const n=W_();w.roomCodeDisplay&&(w.roomCodeDisplay.innerText=n),X_(e,n)}),w.btnHostCancel&&w.btnHostCancel.addEventListener("click",i=>{i.stopPropagation(),Mn(),w.panelHostWaiting&&(w.panelHostWaiting.style.display="none"),w.panelMp&&(w.panelMp.style.display="flex")}),w.btnHostStart&&w.btnHostStart.addEventListener("click",i=>{i.stopPropagation(),a.pendingPlay=!0,w.blocker&&(w.blocker.style.display="none"),a.controls&&a.controls.lock()}),w.btnMpJoinView&&w.btnMpJoinView.addEventListener("click",i=>{i.stopPropagation();const e=w.inputUsername?w.inputUsername.value.trim():"Guest",t=gc(e);if(t){w.mpNameError&&(w.mpNameError.innerText=t);return}w.mpNameError&&(w.mpNameError.innerText=""),w.panelMp&&(w.panelMp.style.display="none"),w.panelJoinRoom&&(w.panelJoinRoom.style.display="flex"),w.joinErrorLog&&(w.joinErrorLog.innerText="")}),w.btnJoinCancel&&w.btnJoinCancel.addEventListener("click",i=>{i.stopPropagation(),w.panelJoinRoom&&(w.panelJoinRoom.style.display="none"),w.panelMp&&(w.panelMp.style.display="flex")}),w.btnJoinConnect&&w.btnJoinConnect.addEventListener("click",i=>{if(i.stopPropagation(),w.btnJoinConnect&&w.btnJoinConnect.dataset.connected==="true"){a.pendingPlay=!0,w.blocker&&(w.blocker.style.display="none"),a.controls&&a.controls.lock();return}const e=w.inputUsername?w.inputUsername.value.trim():"Guest",t=w.inputRoomCode?w.inputRoomCode.value.trim().toUpperCase():"";if(t.length!==4){w.joinErrorLog&&(w.joinErrorLog.innerText="Code must be 4 characters long!");return}w.btnJoinConnect&&(w.btnJoinConnect.disabled=!0,w.btnJoinConnect.innerText="Connecting..."),q_(e,t)}),w.btnPauseResume&&w.btnPauseResume.addEventListener("click",i=>{i.stopPropagation(),a.controls&&a.controls.lock()}),w.btnPauseLeave&&w.btnPauseLeave.addEventListener("click",i=>{i.stopPropagation(),a.isPlaying=!1,a.isMultiplayer&&Mn(),w.panelPause&&(w.panelPause.style.display="none"),w.panelMain&&(w.panelMain.style.display="flex"),kt()}),w.btnDeathRespawn&&w.btnDeathRespawn.addEventListener("click",i=>{i.stopPropagation(),_c(),us(new P(0,2,0)),a.isThirdPerson&&a.playerMesh&&(a.playerMesh.visible=!0),w.deathOverlay&&(w.deathOverlay.style.display="none"),a.controls&&a.controls.lock()}),w.btnDeathLeave&&w.btnDeathLeave.addEventListener("click",i=>{i.stopPropagation(),a.isPlaying=!1,_c(),a.isMultiplayer&&Mn(),w.deathOverlay&&(w.deathOverlay.style.display="none"),w.panelPause&&(w.panelPause.style.display="none"),w.panelMain&&(w.panelMain.style.display="flex")}),w.btnCopyCode&&w.btnCopyCode.addEventListener("click",i=>{i.stopPropagation();const e=a.roomCode||(w.roomCodeDisplay?w.roomCodeDisplay.innerText:"");e&&e!=="----"&&w.btnCopyCode&&(navigator.clipboard.writeText(e),w.btnCopyCode.textContent="✅ Kopiert",setTimeout(()=>{w.btnCopyCode&&(w.btnCopyCode.textContent="📋 Kopieren")},1500))})}function D0(){const i=t=>{switch(t.code){case"KeyW":a.moveForward=!0;break;case"KeyA":a.moveLeft=!0;break;case"KeyS":a.moveBackward=!0;break;case"KeyD":a.moveRight=!0;break;case"ShiftLeft":case"ShiftRight":a.controls&&a.controls.isLocked&&(a.isShiftDown=!0);break;case"Space":if(!a.controls||!a.controls.isLocked)break;a.hookState==="PULLING"?(kt(),a.velocity.y=Dl*.8,a.canJump=!1,Rn.copy(a.controls.getObject().position),Rn.y-=1.8,lr(Rn,50,!0),cr(Rn,15),ic()):a.canJump&&(a.velocity.y+=Dl,a.canJump=!1,Rn.copy(a.controls.getObject().position),Rn.y-=1.8,lr(Rn,50,!0),cr(Rn,15),ic()),zt();break;case"KeyR":a.controls&&a.controls.isLocked&&(zt(),I_());break;case"KeyE":if(a.controls&&a.controls.isLocked){const r=(vo.indexOf(a.desiredWeaponName)+1)%vo.length;a.desiredWeaponName=vo[r],zt()}break;case"Digit1":a.controls&&a.controls.isLocked&&(a.desiredWeaponName="PISTOL",zt());break;case"Digit2":a.controls&&a.controls.isLocked&&(a.desiredWeaponName="AR",zt());break;case"Digit3":a.controls&&a.controls.isLocked&&(a.desiredWeaponName="SHOTGUN",zt());break;case"Digit4":a.controls&&a.controls.isLocked&&(a.desiredWeaponName="SNIPER",zt());break;case"Digit5":a.controls&&a.controls.isLocked&&(a.desiredWeaponName="MINIGUN",zt());break;case"KeyX":a.controls&&a.controls.isLocked&&a.switchState==="IDLE"&&(a.inspectState="INSPECTING",a.inspectTimer=0);break;case"KeyC":a.controls&&a.controls.isLocked&&(a.keyCActive=!0,a.isScoped=a.rightClickActive||a.keyCActive,zt());break;case"KeyP":a.controls&&a.controls.isLocked&&l0(!a.isThirdPerson);break}},e=t=>{switch(t.code){case"KeyW":a.moveForward=!1;break;case"KeyA":a.moveLeft=!1;break;case"KeyS":a.moveBackward=!1;break;case"KeyD":a.moveRight=!1;break;case"KeyC":a.keyCActive=!1,a.isScoped=a.rightClickActive||a.keyCActive;break;case"ShiftLeft":case"ShiftRight":a.isShiftDown=!1;break}};window.addEventListener("keydown",i),window.addEventListener("keyup",e),window.addEventListener("mousedown",t=>{if(a.controls&&a.controls.isLocked&&t.preventDefault(),t.button===0){if(a.isMouseDown=!0,!a.controls||!a.controls.isLocked)return;a.inspectState==="INSPECTING"&&zt(),a.fireCooldown<=0&&a.switchState==="IDLE"&&mh()}else t.button===2&&a.controls&&a.controls.isLocked&&(a.rightClickActive=!0,a.isScoped=a.rightClickActive||a.keyCActive,zt())}),window.addEventListener("mouseup",t=>{a.controls&&a.controls.isLocked&&t.preventDefault(),t.button===0?a.isMouseDown=!1:t.button===2&&(a.rightClickActive=!1,a.isScoped=a.rightClickActive||a.keyCActive)}),window.addEventListener("contextmenu",t=>{a.controls&&a.controls.isLocked&&t.preventDefault()}),window.addEventListener("resize",C0)}function I0(){if(!a.scene||!a.controls)return;a.scene.add(a.controls.getObject()),s0(),a0(),b0();const i=new gt(.035,.035,1,8);i.rotateX(Math.PI/2);const e=new Lt({color:43775,roughness:.3,metalness:.6});a.hookMesh=new ce(i,e),a.hookMesh.castShadow=!0,a.hookMesh.receiveShadow=!0;const t=128;for(let n=0;n<t;n++){const r=new vt({color:16777215}),s=new ce(ys,r);s.userData={},s.visible=!1,a.projectilePool.push(s)}}function _c(){A_(),w.score&&(w.score.innerText="0"),Ss(100),a.controls&&a.controls.getObject().position.set(0,2,0),kt()}function Mh(i,e){var n;if(!a.isMultiplayer||a.connections.length===0)return;const t={type:"player_died",victimName:i,killerName:e,victimPeerId:(n=a.peer)==null?void 0:n.id};a.connections.forEach(r=>{if(r.open)try{r.send(t)}catch(s){console.error("Error broadcasting player_died:",s)}})}function U0(){k_(Uo,N0),P0();let i=1;if(w.sensSlider){let e=parseFloat(w.sensSlider.value);isNaN(e)||(i=e)}a.baseSensitivity=i,a.controls&&(a.controls.pointerSpeed=a.baseSensitivity),w.sensValue&&(w.sensValue.innerText=a.baseSensitivity.toFixed(1)),w.sensSlider&&w.sensValue&&(w.sensSlider.addEventListener("input",e=>{let t=parseFloat(e.target.value);isNaN(t)&&(t=1),t=Math.max(.1,Math.min(3,t)),a.baseSensitivity=t,w.sensValue.innerText=t.toFixed(1),a.controls&&(a.controls.pointerSpeed=t*(a.camera?a.camera.fov/as:1))}),w.sensSlider.addEventListener("click",e=>e.stopPropagation())),L0(),a.controls&&(a.controls.addEventListener("lock",()=>{a.pendingPlay&&(a.isPlaying=!0,a.pendingPlay=!1,us(new P(0,2,0))),w.blocker&&(w.blocker.style.display="none"),w.panelPause&&(w.panelPause.style.display="none"),w.healthContainer&&(w.healthContainer.style.display="block"),w.reloadContainer&&(w.reloadContainer.style.display="block"),w.hoverContainer&&(w.hoverContainer.style.display="block"),w.pvpStats&&(w.pvpStats.style.display=a.isMultiplayer?"block":"none"),w.crosshair&&(w.crosshair.style.display="block"),w.ui&&(w.ui.style.display="flex"),w.fpsCounter&&(w.fpsCounter.style.display="block"),document.body.focus(),a.renderer&&a.renderer.domElement&&(a.renderer.domElement.tabIndex=1,a.renderer.domElement.focus())}),a.controls.addEventListener("unlock",()=>{if(w.blocker&&(w.blocker.style.display="flex"),a.moveForward=!1,a.moveBackward=!1,a.moveLeft=!1,a.moveRight=!1,a.isShiftDown=!1,a.isHovering=!1,a.isMouseDown=!1,a.isScoped=!1,a.rightClickActive=!1,a.keyCActive=!1,zt(),w.healthContainer&&(w.healthContainer.style.display="none"),w.reloadContainer&&(w.reloadContainer.style.display="none"),w.hoverContainer&&(w.hoverContainer.style.display="none"),w.hoverBadge&&(w.hoverBadge.style.display="none"),w.panelMain&&(w.panelMain.style.display="none"),w.panelMp&&(w.panelMp.style.display="none"),w.panelHostWaiting&&(w.panelHostWaiting.style.display="none"),w.panelJoinRoom&&(w.panelJoinRoom.style.display="none"),a.isPlaying){const e=w.deathOverlay&&w.deathOverlay.style.display==="flex";w.panelPause&&(w.panelPause.style.display=e?"none":"flex"),a.isMultiplayer?(w.pauseLobbyInfo&&(w.pauseLobbyInfo.style.display=e?"none":"inline"),w.pauseRoomCode&&(w.pauseRoomCode.innerText=a.roomCode||"----"),w.btnPauseLeave&&(w.btnPauseLeave.innerText="Leave Lobby")):(w.pauseLobbyInfo&&(w.pauseLobbyInfo.style.display="none"),w.btnPauseLeave&&(w.btnPauseLeave.innerText="Leave Game"))}else w.panelPause&&(w.panelPause.style.display="none"),w.panelMain&&(w.panelMain.style.display="flex"),a.isMultiplayer&&Mn();kt()})),D0(),I0(),xh()}function xh(){var s;requestAnimationFrame(xh);const i=performance.now(),e=(i-a.prevTime)/1e3;if(o0(e),w.reloadBar){const l=ls[a.activeWeaponName],o=l?l.fireRate:.1,c=Math.max(0,Math.min(1,1-a.fireCooldown/o));c!==dc&&(w.reloadBar.style.width=`${c*100}%`,dc=c)}a.controls&&a.controls.isLocked&&a.isMouseDown&&(a.activeWeaponName==="AR"||a.activeWeaponName==="MINIGUN")&&a.fireCooldown<=0&&a.switchState==="IDLE"&&(a.inspectState==="INSPECTING"&&zt(),mh()),B_(e),R0(a.hoverFuel),O0(),F0(e),U_(e);const t=a.isMultiplayer?a.peerIds:[],n=t.length,r=((s=ls[a.activeWeaponName])==null?void 0:s.damage)??1;for(let l=a.projectiles.length-1;l>=0;l--){const o=a.projectiles[l];o.userData.age+=e,o.position.x+=o.userData.dx*ao*e,o.position.y+=o.userData.dy*ao*e,o.position.z+=o.userData.dz*ao*e;let c=!1;const h=a.targets.length;for(let u=0;u<h;u++){const d=a.targets[u],p=o.position.distanceTo(d.position),g=o_*(d.userData.scale||1);if(p<g){a.isMultiplayer?a.isHost?Uo(u,r):a.connections.forEach(v=>{if(v.open)try{v.send({type:"hit_target",targetIndex:u,damage:r})}catch(_){console.error("Error broadcasting hit_target:",_)}}):Uo(u,r),c=!0,Jt(o.position,16755200,8,12,.15,20);break}}if(!c&&a.isMultiplayer)for(let u=0;u<n;u++){const d=t[u],p=a.peers[d];if(p&&p.mesh&&o.position.distanceTo(p.mesh.position)<ar){c=!0,Jt(o.position,9206502,8,12,.15,20),$o(p,16724787,150);const m=(w.inputUsername?w.inputUsername.value.trim():"Guest")||"Guest";a.connections.forEach(f=>{if(f.open)try{f.send({type:"player_hit",targetPeerId:d,damage:r,attackerName:m})}catch(y){console.error("Error broadcasting player_hit:",y)}});break}}(c||o.userData.age>Jg)&&(a.scene.remove(o),o.visible=!1,a.projectilePool.push(o),a.projectiles[l]=a.projectiles[a.projectiles.length-1],a.projectiles.pop())}if(A0(e),L_(e),a.isMultiplayer&&j_(),B0(),Mo++,i>=xo+1e3&&(w.fpsCounter&&(w.fpsCounter.textContent=`FPS: ${Math.round(Mo*1e3/(i-xo))}`),Mo=0,xo=i),a.prevTime=i,a.camera){const l=a.isScoped?Zg:as;Math.abs(a.camera.fov-l)>.1?(a.camera.fov+=(l-a.camera.fov)*Qg*e,a.camera.updateProjectionMatrix()):a.camera.fov!==l&&(a.camera.fov=l,a.camera.updateProjectionMatrix()),a.controls&&a.camera.fov!==pc&&(a.controls.pointerSpeed=a.baseSensitivity*(a.camera.fov/as),pc=a.camera.fov),w.gogglesScope&&w.crosshair&&a.isScoped!==mc&&(a.isScoped?(w.gogglesScope.style.display="block",w.crosshair.style.display="none",w.ui&&(w.ui.style.display="none"),w.fpsCounter&&(w.fpsCounter.style.display="none"),w.healthContainer&&(w.healthContainer.style.display="none"),w.reloadContainer&&(w.reloadContainer.style.display="none"),w.hoverContainer&&(w.hoverContainer.style.display="none")):(w.gogglesScope.style.display="none",w.crosshair.style.display="block",w.ui&&(w.ui.style.display="flex"),w.fpsCounter&&(w.fpsCounter.style.display="block"),w.healthContainer&&(w.healthContainer.style.display=a.controls&&a.controls.isLocked?"block":"none"),w.reloadContainer&&(w.reloadContainer.style.display=a.controls&&a.controls.isLocked?"block":"none"),w.hoverContainer&&(w.hoverContainer.style.display=a.controls&&a.controls.isLocked?"block":"none")),mc=a.isScoped)}if(a.renderer&&a.scene&&a.camera){let l=null;try{a.isThirdPerson&&(l=w0.copy(a.camera.position),hc.set(0,0,-1).applyQuaternion(a.camera.quaternion),_o.copy(hc).multiplyScalar(-6),_o.y+=1.5,a.camera.position.add(_o)),a.renderer.render(a.scene,a.camera)}finally{a.isThirdPerson&&l&&a.camera.position.copy(l)}}}function N0(i,e){if(!(!a.isPlaying||a.playerHp<=0)){if(a.playerHp-=i,a.lastDamageTime=performance.now(),a.controls){const t=vh.copy(a.controls.getObject().position);t.y-=.5,Jt(t,16724736,10,15,.2,12)}if(Ss(Math.max(0,a.playerHp/a.playerMaxHp)*100,"#ff4757"),a.playerHp<=0){yh(),a.deaths++,w.deaths&&(w.deaths.innerText=a.deaths.toString());const n=(w.inputUsername?w.inputUsername.value.trim():"Guest")||"Guest";Mh(n,e)}}}function yh(){if(w.panelPause&&(w.panelPause.style.display="none"),w.crosshair&&(w.crosshair.style.display="none"),w.ui&&(w.ui.style.display="none"),w.fpsCounter&&(w.fpsCounter.style.display="none"),w.healthContainer&&(w.healthContainer.style.display="none"),w.reloadContainer&&(w.reloadContainer.style.display="none"),w.deathOverlay&&(w.deathOverlay.style.display="flex"),a.controls){a.controls.unlock();const i=a.controls.getObject();Jt(i.position,3889560,40,16,.45,6)}a.playerMesh&&(a.playerMesh.visible=!1),a.velocity.set(0,0,0),kt(),a.isHovering=!1,w.hoverBadge&&(w.hoverBadge.style.display="none")}function Uo(i,e){const t=a.targets[i];if(!t)return;t.userData.hp-=e;const n=Math.max(0,t.userData.hp/t.userData.maxHp);if(t.userData.healthBarFg.scale.x=n,t.userData.hp<=0){const r=t.userData.color||16729344;Jt(t.position,r,35,30,.35,15),cr(t.position,8*(t.userData.scale||1),16755200),a.hookState==="PULLING"&&a.hookIsEnemy&&a.hookTargetEnemy===t&&kt(),_h(t),a.score++,w.score&&(w.score.innerText=a.score.toString()),a.isMultiplayer&&a.isHost&&K_(i,a.score,t.position,t.userData)}}function O0(i){if(!a.controls||!a.controls.isLocked&&!a.isMultiplayer)return;const e=a.controls.getObject();if(e.position.y-Do<=.15){let n=!1;const r=a.lavaPools.length;for(let s=0;s<r;s++){const l=a.lavaPools[s],o=Math.abs(e.position.x-l.position.x),c=Math.abs(e.position.z-l.position.z);if(o<on+ar&&c<on+ar){n=!0;break}}if(n){const s=performance.now();if(s-a.lastDamageTime>=e_){a.playerHp-=t_,a.lastDamageTime=s,a.regenTimer=0;const l=vh.copy(e.position);if(l.y-=1.8,Jt(l,16724736,6,10,.15,5),Ss(Math.max(0,a.playerHp/a.playerMaxHp)*100,"#ff4757"),a.playerHp<=0&&(yh(),a.deaths++,w.deaths&&(w.deaths.innerText=a.deaths.toString()),a.isMultiplayer&&a.peer)){const c=(w.inputUsername?w.inputUsername.value.trim():"Guest")||"Guest";Mh(c,"Lava")}}}}}function F0(i){if(!a.isPlaying||a.playerHp<=0||a.playerHp>=a.playerMaxHp){a.regenTimer=0;return}performance.now()-a.lastDamageTime>=x_?(a.regenTimer+=i,a.regenTimer>=1&&(a.playerHp=Math.min(a.playerMaxHp,a.playerHp+1),a.regenTimer-=1,Ss(a.playerHp/a.playerMaxHp*100))):a.regenTimer=0}function B0(i){if(!a.isPlaying||!a.controls)return;const t=a.controls.getObject().position,n=y_,r=n-Math.abs(t.x),s=n-Math.abs(t.z),l=Math.min(r,s);if(w.worldBorderOverlay)if(l<co){w.worldBorderOverlay.style.display="block";const o=Math.max(0,Math.min(1,(co-l)/co));if(l<=S_){const c=performance.now()/1e3,h=.6+.25*Math.sin(c*6);w.worldBorderOverlay.style.opacity=h.toString()}else w.worldBorderOverlay.style.opacity=(o*.45).toString()}else w.worldBorderOverlay.style.opacity="0",w.worldBorderOverlay.style.display="none"}U0();
