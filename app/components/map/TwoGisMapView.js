import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import WebView from 'react-native-webview';

const TWOGIS_API_KEY = '48dde3c2-b611-48eb-9d76-3a67b78a849e';

const buildHtml = (apiKey) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{width:100%;height:100%;overflow:hidden;background:#e8e0d8}

/* Custom marker */
.pin{width:38px;height:48px;cursor:pointer;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.28));transition:transform .15s}
.pin:active{transform:scale(0.92)}

/* Popup card */
#popup{
  position:fixed;bottom:72px;left:14px;right:14px;
  background:#fff;border-radius:20px;
  padding:16px 16px 12px;
  box-shadow:0 8px 32px rgba(0,0,0,0.18);
  display:none;z-index:200;
  animation:slideUp .2s ease
}
@keyframes slideUp{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
#popup-close{
  position:absolute;top:12px;right:12px;
  width:26px;height:26px;border-radius:13px;
  background:#F3F4F6;border:none;cursor:pointer;
  font-size:16px;color:#9CA3AF;line-height:26px;text-align:center
}
#popup-name{font-weight:700;font-size:15px;color:#111827;margin-bottom:4px;padding-right:30px;line-height:1.3}
#popup-address{font-size:13px;color:#6B7280;margin-bottom:12px;line-height:1.4}
#popup-btn{
  width:100%;padding:12px;border-radius:12px;border:none;
  background:#2563EB;color:#fff;font-size:15px;font-weight:700;
  cursor:pointer;letter-spacing:0.2px
}
#popup-btn:active{background:#1D4ED8}

/* Zoom controls */
#zoom-box{
  position:fixed;right:14px;bottom:160px;
  display:flex;flex-direction:column;gap:4px;z-index:100
}
.zoom-btn{
  width:42px;height:42px;border-radius:11px;
  background:#fff;border:1px solid rgba(0,0,0,0.1);
  box-shadow:0 2px 8px rgba(0,0,0,0.12);
  font-size:22px;line-height:42px;text-align:center;
  cursor:pointer;color:#374151;font-weight:400;
  user-select:none;-webkit-user-select:none
}
.zoom-btn:active{background:#F3F4F6}
</style>
</head>
<body>
<div id="map"></div>

<div id="popup">
  <button id="popup-close" onclick="closePopup()">×</button>
  <div id="popup-name"></div>
  <div id="popup-address"></div>
  <button id="popup-btn" onclick="onNavigate()">Перейти в школу →</button>
</div>

<div id="zoom-box">
  <div class="zoom-btn" onclick="doZoom(1)">+</div>
  <div class="zoom-btn" onclick="doZoom(-1)">−</div>
</div>

<script>
var _map=null, _pins=[], _q=[], _curId=null, _schools={};

function _rn(d){try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(d));}catch(e){}}

function handlePinClick(id){
  var s=_schools[id];
  if(s)showPopup(s);
}

function doZoom(delta){
  if(!_map)return;
  try{_map.setZoom(_map.getZoom()+delta,{animate:true});}catch(e){}
}

function closePopup(){
  document.getElementById('popup').style.display='none';
  _curId=null;
}

function onNavigate(){
  if(_curId)_rn({t:'markerClick',id:_curId});
}

function showPopup(s){
  _curId=s.id;
  document.getElementById('popup-name').textContent=s.name||'';
  document.getElementById('popup-address').textContent=s.address||s.city||'';
  document.getElementById('popup').style.display='block';
}

function makePinSvg(id){
  return '<div class="pin" onclick="handlePinClick(\''+id+'\')">'+
    '<svg width="40" height="52" viewBox="0 0 40 52" fill="none" xmlns="http://www.w3.org/2000/svg">'+
    '<path d="M20 0C9 0 0 9 0 20C0 35.5 20 52 20 52C20 52 40 35.5 40 20C40 9 31 0 20 0Z" fill="#2563EB"/>'+
    '<circle cx="20" cy="20" r="13" fill="white"/>'+
    '<path d="M12 29V19.5L20 14L28 19.5V29H24V23.5H16V29H12Z" fill="#2563EB"/>'+
    '<rect x="17" y="23.5" width="6" height="5.5" rx="1" fill="white"/>'+
    '<rect x="13.5" y="20" width="4" height="3.5" rx="0.5" fill="#DBEAFE"/>'+
    '<rect x="22.5" y="20" width="4" height="3.5" rx="0.5" fill="#DBEAFE"/>'+
    '</svg></div>';
}

function _applyMsg(m){
  if(m.t==='setMarkers'){
    _pins.forEach(function(p){try{p.destroy();}catch(e){}});
    _pins=[];
    _schools={};
    closePopup();
    (m.d||[]).forEach(function(s){
      if(!s.lat||!s.lon)return;
      _schools[s.id]=s;
      try{
        var p;
        if(typeof mapgl.HtmlMarker!=='undefined'){
          p=new mapgl.HtmlMarker(_map,{
            coordinates:[s.lon,s.lat],
            html:makePinSvg(s.id),
            anchor:[0.5,1.0]
          });
        }else{
          p=new mapgl.Marker(_map,{coordinates:[s.lon,s.lat]});
          p.on('click',(function(school){return function(){showPopup(school);};})(s));
        }
        _pins.push(p);
      }catch(e){}
    });
  }else if(m.t==='flyTo'){
    closePopup();
    try{
      _map.setCenter([m.lon,m.lat],{animate:true});
      _map.setZoom(m.zoom||15,{animate:true});
    }catch(e){}
  }
}

function _handleMsg(raw){
  try{var m=JSON.parse(raw);if(!_map){_q.push(m);}else{_applyMsg(m);}}catch(e){}
}
window.addEventListener('message',function(e){_handleMsg(e.data);});
document.addEventListener('message',function(e){_handleMsg(e.data);});

function _initMap(){
  _map=new mapgl.Map('map',{
    center:[71.4459,51.1694],
    zoom:11,
    key:'${apiKey}',
    lang:'ru',
    controls:[]
  });
  _map.on('click',function(){closePopup();});
  /* hide default 2GIS controls */
  try{
    var s2=document.createElement('style');
    s2.textContent='[class*="zoom"],[class*="Zoom"],[class*="ctrl"],[class*="Ctrl"],[class*="control"],[class*="Control"]{display:none!important}';
    document.head.appendChild(s2);
  }catch(e){}

  var _readyFired=false;
  function _fireReady(){
    if(_readyFired)return;
    _readyFired=true;
    _q.forEach(function(m){_applyMsg(m);});
    _q=[];
    _rn({t:'ready'});
  }
  try{ _map.on('idle',_fireReady); }catch(e){}
  setTimeout(_fireReady, 1500);
}
</script>
<script src="https://mapgl.2gis.com/api/js/v1" onload="_initMap()"></script>
</body>
</html>`;

export default function TwoGisMapView({
  markers = [],
  onMarkerPress,
  focusPoint,
  focusRegion,
  style,
}) {
  const webRef = useRef(null);
  const isReady = useRef(false);
  const pendingMarkersRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  const sendMarkers = (markerList) => {
    if (!webRef.current) return;
    const payload = markerList.map((m) => ({
      id: m.id,
      lat: m.latitude,
      lon: m.longitude,
      name: m.name,
      address: m.address || '',
      city: m.city || '',
    }));
    webRef.current.postMessage(JSON.stringify({ t: 'setMarkers', d: payload }));
  };

  useEffect(() => {
    if (isReady.current) {
      sendMarkers(markers);
    } else {
      pendingMarkersRef.current = markers;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  useEffect(() => {
    if (!focusPoint || !isReady.current || !webRef.current) return;
    if (!Number.isFinite(focusPoint.latitude) || !Number.isFinite(focusPoint.longitude)) return;
    webRef.current.postMessage(
      JSON.stringify({ t: 'flyTo', lat: focusPoint.latitude, lon: focusPoint.longitude, zoom: 15 })
    );
  }, [focusPoint]);

  useEffect(() => {
    if (!focusRegion || !isReady.current || !webRef.current) return;
    if (!Number.isFinite(focusRegion.latitude) || !Number.isFinite(focusRegion.longitude)) return;
    webRef.current.postMessage(
      JSON.stringify({ t: 'flyTo', lat: focusRegion.latitude, lon: focusRegion.longitude, zoom: 13 })
    );
  }, [focusRegion]);

  const handleMessage = (e) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.t === 'ready') {
        isReady.current = true;
        const pending = pendingMarkersRef.current ?? markers;
        sendMarkers(pending);
        pendingMarkersRef.current = null;
        // Fade out the loading overlay
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setMapReady(true));
      } else if (msg.t === 'markerClick' && onMarkerPress) {
        onMarkerPress({ id: msg.id });
      }
    } catch (_) {}
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webRef}
        source={{ html: buildHtml(TWOGIS_API_KEY) }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        allowsInlineMediaPlayback
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
      {!mapReady && (
        <Animated.View style={[styles.loadingOverlay, { opacity: overlayOpacity }]}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Загрузка карты...</Text>
            <Text style={styles.loadingSubText}>2GIS</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#e8e0d8',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E9EEF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: 'exoSemibold',
    fontSize: 16,
    color: '#111827',
    marginTop: 4,
  },
  loadingSubText: {
    fontFamily: 'exoSemibold',
    fontSize: 13,
    color: '#2563EB',
    letterSpacing: 1,
  },
});
