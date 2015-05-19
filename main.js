/*
 * BLE Demo App based on bluetooth v2 api. https://wiki.mozilla.org/B2G/Bluetooth/WebBluetooth-v2
 * GATT Service UUID: https://developer.bluetooth.org/gatt/services/Pages/ServicesHome.aspx
 * GATT Characteristics:  https://developer.bluetooth.org/gatt/characteristics/Pages/CharacteristicsHome.aspx
 * TODO:
 * 1. Gecko UUID translation
 */

document.addEventListener("DOMContentLoaded", function(event) {
  console.log("DOM fully loaded and parsed");

  var bluetooth = window.navigator.mozBluetooth;
  var defaultAdapter = null;
  var startSearchDeviceBtn = document.getElementById('start-search-device');
  var stopSearchDeviceBtn = document.getElementById('stop-search-device');
  var updateRssiBtn = document.getElementById('update-rssi');
  var backBtn = document.getElementById('back');
  var discoveryHandler = null;
  var gattConnectState = document.getElementById('conn-state');
  var gattRemoteRSSI = document.getElementById('remote-rssi');
  var gattClient = null;
  var selectedService = null;
  var selectedChar = null;
  var notifyChar = null;
  var selectedDesc = null;
  var selectedDevice = null;
  var cccDescriptor = null;
  var BLESHIELD_SERVICE_UUID = '713d0000-503e-4c75-ba94-3148f18d941e';
  var BLESHIELD_TX_UUID = '713d0002-503e-4c75-ba94-3148f18d941e';
  var BLESHIELD_RX_UUID = '713d0003-503e-4c75-ba94-3148f18d941e';
  var CCCD_UUID = '00002902-0000-1000-8000-00805f9b34fb';

  var notify = document.getElementById('notify');
  var notifyStatus = document.getElementById('notify-status');

  var servo = document.getElementById('servo');
  var anaIn = document.getElementById('ana-in');
  var digiOut = document.getElementById('digi-out');
  var digiIn = document.getElementById('digi-in');
  var digiOutVal = document.getElementById('digi-out-val');
  var digiInVal = document.getElementById('digi-in-val');
  var anaInVal = document.getElementById('ana-in-val');
  var servoVal = document.getElementById('servo-val');

  defaultAdapter = bluetooth.defaultAdapter;
  if (defaultAdapter) {
    console.log('defaultAdapter get!');
  } else {
    console.log('defaultAdapter not get! We need to wait adapter added');
  }

  function showStartDiscovery() {
    startSearchDeviceBtn.style.display = 'block';
    stopSearchDeviceBtn.style.display = 'none';
  }

  function showStopDiscovery() {
    startSearchDeviceBtn.style.display = 'none';
    stopSearchDeviceBtn.style.display = 'block';
  }

  bluetooth.onattributechanged = function onManagerAttributeChanged(evt) {
    console.log('register adapterchanged');
    for (var i in evt.attrs) {
      console.log('--> onattributechanged(): evt.attrs[i] = ' + evt.attrs[i]);
      switch (evt.attrs[i]) {
        case 'defaultAdapter':
          console.log("!!!defaultAdapter changed. address:", bluetooth.defaultAdapter.address);
          defaultAdapter = bluetooth.defaultAdapter;

          defaultAdapter.onattributechanged = function onAdapterAttributeChanged(evt) {
            console.log('--> _onAdapterAttributeChanged.... ');
            for (var i in evt.attrs) {
              console.log('---> _onAdapterAttributeChanged.... ' + evt.attrs[i]);
              switch (evt.attrs[i]) {
                case 'state':
                  if (defaultAdapter.state === 'enabled') {
                    console.log('bluetooth enabled!!!!!');
                  }
                  break;
                case 'address':
                  console.log('adapter address' + defaultAdapter.address);
                  break;
                case 'name':
                  console.log('adapter name: ' + defaultAdapter.name);
                  break;
                case 'discoverable':
                  console.log('discoverable state: ' + defaultAdapter.discoverable);
                  break;
                case 'discovering':
                  console.log('discovering' + defaultAdapter.discovering);
                  if (defaultAdapter.discovering) {
                    showStartDiscovery();
                  }
                  else {
                    showStopDiscovery();
                  }
                  break;
                default:
                  break;
              }
            }
          };
          enableBluetooth();
          break;
        default:
          break;
      }
    }
  };

  function enableBluetooth() {
    console.log('enable bluetooth');
//    defaultAdapter.enable();
  }

  function disableBluetooth() {
    console.log('disable bluetooth');
//    defaultAdapter.disable();
  }

  function clearList(listId) {
    var list = document.getElementById(listId);
    if (list) {
      while (list.firstChild) list.removeChild(list.firstChild);
    }
  }

  function deviceDiscovery() {
//    defaultAdapter.startDiscovery().then(function onResolve(handle) {
    defaultAdapter.startLeScan([]).then(function onResolve(handle) {
      showStopDiscovery();
      discoveryHandler = handle;
      discoveryHandler.ondevicefound = function onDeviceFound(evt) {
        //console.log('-->_onDeviceFound(): evt = ' + evt);
        addDeviceToList(evt.device);
      }; // ondevice found
    }, function onReject(reason) {
      console.log('--> startDiscovery failed: reason = ' + reason);
    }); //startdiscovery resolve
  }

  function discoverDevices() {
    disconnect(function() {
      if (defaultAdapter) {
        console.log('---------btn press, start discovery --------');
        // clean up device list
        clearList('device-list');

        console.log('precheck device discovering: ' + defaultAdapter.discovering);
        if (defaultAdapter.discovering == true) {
//          defaultAdapter.stopDiscovery().then(function onResolve() {
          defaultAdapter.stopLeScan(discoveryHandler).then(function onResolve() {
            showStartDiscovery();
            deviceDiscovery();
          }, function onReject(reason) {
            console.log('--> stopDiscovery failed: reason = ' + reason);
          }); //stopdiscoverty resolve
        } else {
          deviceDiscovery();
        }
      }
      showPage('devices');
    });
  }

  startSearchDeviceBtn.onclick = discoverDevices;

  stopSearchDeviceBtn.onclick = function stopSearchDevice() {
    disconnect(function() {
//      defaultAdapter.stopDiscovery().then(function onResolve() {
      defaultAdapter.stopLeScan(discoveryHandler).then(function onResolve() {
        showStartDiscovery();
        console.log('--> stopDiscovery complete');
      }, function onReject(reason) {
        console.log('--> stopDiscovery failed: reason = ' + reason);
      }); //stopdiscoverty resolve
    });
  };

  function addDeviceToList(device) {
    console.log("found '" + device.name + "' of type '"+device.type+"'");

    if (device.gatt) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      var h = document.createElement('p');
      h.textContent = device.name;
      var p = document.createElement('p');
      p.textContent = device.address;
      a.appendChild(h);
      a.appendChild(p);
      a.onclick = function(e) {
        selectedDevice = device;
        gattClient = device.gatt;

        gattClient.oncharacteristicchanged = function onCharacteristicChanged(e) {
          var characteristic = e.characteristic;
          console.log('The value of characteristic (uuid:', characteristic.uuid, ') changed to ', characteristic.value);
          if (characteristic.value) {
            var values = toHexString(characteristic.value).match(/.{1,6}/g);
            console.log(values);
            for (var i in values) {
              var pin = parseInt(values[i].substr(0, 2), 16);
              var content = parseInt(values[i].substr(2, 4), 16);
              if (pin == 0x0A) {
                digiIn.checked = content == 0x0100;
                digiInVal.textContent = digiIn.checked ? 'High' : 'Low';
              }
              else if (pin == 0x0B) {
                anaInVal.textContent = content;
              }
            }
          }
        };

        gattClient.onconnectionstatechanged = function onConnectionStateChanged(e) {
          console.log(gattClient.connectionState);
          gattConnectState.textContent = gattClient.connectionState;
        };

        gattClient.connect().then(function onResolve() {
          console.log("connected");
          discoverServices();
        }, function onReject(reason) {
          console.log('connect failed: reason = ' + reason);
        });
        console.log('gattClient assigned with device.name = ' + device.name);
      };
      li.appendChild(a);
      var list = document.getElementById('device-list');
      list.appendChild(li);
    }
  }

  function updateRemoteRSSI() {
    gattClient.readRemoteRssi().then(function onResolve(rssi) {
      console.log(rssi);
      gattRemoteRSSI.textContent = rssi.toString() + ' dBm';
    }, function onReject(reason) {
      console.log('failed to read remote rssi: reason = ' + reason);
    });
  }

  updateRssiBtn.onclick = updateRemoteRSSI;

  function discoverServices() {
    if (gattClient) {
      console.log('start to discover services');
      selectedService = null;

      gattClient.discoverServices().then(function onResolve() {
        updateRemoteRSSI();
        for (var i in gattClient.services) {
          var s = gattClient.services[i];
          if (s.uuid == BLESHIELD_SERVICE_UUID) {
            selectedService = s;
            discoverCharacteristics(selectedService);
          }
        }
      }, function onReject(reason) {
        console.log('discover failed: reason = ' + reason);
      });
      showPage('services');
    }
  }

  function discoverCharacteristics(service) {
    selectedChar = null;
    if (selectedService) {
      clearList('char-list');
      console.log('start to discover characteristics');
      console.log(selectedService);
      for (var i in selectedService.characteristics) {
        var c = selectedService.characteristics[i];
        if (c.uuid == BLESHIELD_RX_UUID) {
          selectedChar = c;
          discoverDescriptors(selectedChar);
        }
        if (c.uuid == BLESHIELD_TX_UUID) {
          notifyChar = c;
          discoverDescriptors(notifyChar);
        }
      }
    }
  }

  function composeAttributes(listId, props, item) {
    clearList(listId);
    var list = document.getElementById(listId);
    if (list) {
      for (var name in props) {
        var li = document.createElement('li');
        var h = document.createElement('p');
        h.textContent = name;
        var p = document.createElement('p');
        p.textContent = props[name];
        if (name == 'Value') {
          var a = document.createElement('a');
          a.onclick = function() {
            var valueElement = this.getElementsByTagName('p')[1];
            item.readValue().then(function onResolve(value) {
              var strValue = toHexString(value);
              console.log('!!!!!!!!!!!!!!!! read value = ' + strValue);
              valueElement.textContent = strValue;
            }, function onReject(reason) {
              console.log('readValue failed: reason = ' + reason);
            });
          };
          a.appendChild(h);
          a.appendChild(p);
          li.appendChild(a);
        }
        else {
          li.appendChild(h);
          li.appendChild(p);
        }
        list.appendChild(li);
      }
    }
  }

  function discoverDescriptors(characteristic) {
    selectedDesc = null;
    if (characteristic) {
      clearList('desc-list');
      var props = selectedChar.properties;
      composeAttributes('char', {
        'UUID': characteristic.uuid,
        'ServiceUUID': selectedService.uuid,
        'Device': selectedDevice.name + '(' + selectedDevice.address + ')',
        'InstanceId': characteristic.instanceId,
        'Value': toHexString(characteristic.value),
        'Broadcast': props.broadcast,
        'Read': props.read,
        'WriteNoResponse': props.writeNoResponse,
        'Write': props.write,
        'Notify': props.notify,
        'Indicate': props.indicate,
        'SignedWrite': props.signedWrite,
        'ExtendedProps': props.extendedProps
      }, characteristic);
      console.log('start to discover descriptors');
      console.log(characteristic);
      for (var i in characteristic.descriptors) {
        if (characteristic.descriptors[i].uuid === CCCD_UUID) {
          characteristic.startNotifications().then(function onResolve() {
            console.log('start notification completed');
          }, function onReject(reason) {
            console.log('start notification failed: reason = ' + reason);
          });

          console.log('Found CCCD!!!!');
          cccDescriptor = characteristic.descriptors[i];
          var arrayBuffer = new ArrayBuffer(2);
          var uint8Array = new Uint8Array(arrayBuffer);
          uint8Array[0] = 0x01;
          uint8Array[1] = 0x00;
          cccDescriptor.writeValue(arrayBuffer);
          notifyStatus.textContent = 'Enabled';
        }
      }
    }
  }

  function showPage(page) {
    var pages = document.querySelectorAll('.page');
    for (var i = 0; i < pages.length; i++) {
      pages[i].classList.remove('current-page');
    }
    document.getElementById(page).classList.add('current-page');
    document.getElementById('back').style.display =
      (page == 'devices') ? 'none' : 'block';
  }

  var backHandlers = {
    'services': discoverDevices,
    'characteristics': discoverServices,
    'characteristic': discoverCharacteristics,
    'descriptor': discoverDescriptors
  };

  backBtn.onclick = function(e) {
    backHandlers[document.querySelector('.current-page').id]();
  };

  function disconnect(cb) {
    if (defaultAdapter && gattClient) {
      gattClient.disconnect().then(function onResolve() {
        selectedDevice = null;
        gattClient = null;
        console.log("disconnected");
        if (cb) {
          cb();
        }
      }, function onReject(reason) {
        console.log('disconnect failed: reason = ' + reason);
      });
    }
    else {
      if (cb) {
        cb();
      }
    }
  }
  servo.onchange = function() {
    console.info('ya');
    servoVal.textContent = this.value;
    var result = '03' + parseInt(this.value).toString(16) + '00';
    var array = parseHexString(result);
    console.log(array);
    selectedChar.writeValue(array);
  };

  digiOut.onchange = function() {
    console.info('yo');
    var result = null;
    if (this.checked) {
      result = '010100';
      digiOutVal.textContent = 'High';
    }
    else {
      result = '010000';
      digiOutVal.textContent = 'Low';
    }
    if (result) {
      var array = parseHexString(result);
      console.log(array);
      selectedChar.writeValue(array);
    }
  };
  anaIn.onchange = function() {
    console.info('yo');
    var result = null;
    if (this.checked) {
      result = 'A00100';
    }
    else {
      result = 'A00000';
    }
    if (result) {
      var array = parseHexString(result);
      console.log(array);
      selectedChar.writeValue(array);
    }
  };

  notify.onclick = discoverServices;

  function parseHexString(str) {
    var arrayBuffer = new ArrayBuffer(Math.ceil(str.length / 2));
    var uint8Array = new Uint8Array(arrayBuffer);

    for (var i = 0, j = 0; i < str.length; i += 2, j++) {
      uint8Array[j] = parseInt(str.substr(i, 2), 16);
    }
    console.log(uint8Array);
    return arrayBuffer;
  }

  function toHexString(arrayBuffer) {
    var str = '';
    if (arrayBuffer) {
      console.log(arrayBuffer);
      var uint8Array = new Uint8Array(arrayBuffer);
      for (var i = 0; i < uint8Array.length; i++) {
        var b = uint8Array[i].toString(16);
        if (b.length == 1) {
          str += '0'
        }
        str += b;
      }
    }
    return str;
  }

}); //DOMContentLoaded
