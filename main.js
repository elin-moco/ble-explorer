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
  var startNotiBtn = document.getElementById('start-notification');
  var stopNotiBtn = document.getElementById('stop-notification');
  var writeCharBtn = document.getElementById('write-char');
  var writeDescBtn = document.getElementById('write-desc');
  var updateRssiBtn = document.getElementById('update-rssi');
  var backBtn = document.getElementById('back');
  var discoveryHandler = null;
  var isGattClientConnected = null;
  var gattConnectState = document.getElementById('conn-state');
  var gattRemoteRSSI = document.getElementById('remote-rssi');
  var gattClient = null;
  var selectedService = null;
  var selectedChar = null;
  var selectedDesc = null;
  var selectedDevice = null;
  var bleshieldRx = null;
  var bleshieldTx = null;
  var BLESHIELD_SERVICE_UUID = '713d0000-503e-4c75-ba94-3148f18d941e';
  var BLESHIELD_TX_UUID = '713d0002-503e-4c75-ba94-3148f18d941e';
  var BLESHIELD_RX_UUID = '713d0003-503e-4c75-ba94-3148f18d941e';
  var CCCD_UUID = '00002902-0000-1000-8000-00805f9b34fb';

  var rediscover = document.getElementById('rediscover');

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
    defaultAdapter.enable();
  }

  function disableBluetooth() {
    console.log('disable bluetooth');
    defaultAdapter.disable();
  }

  function clearList(listId) {
    var list = document.getElementById(listId);
    while (list.firstChild) list.removeChild(list.firstChild);
  }

  function deviceDiscovery() {
    defaultAdapter.startDiscovery().then(function onResolve(handle) {
//    defaultAdapter.startLeScan([]).then(function onResolve(handle) {
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
          defaultAdapter.stopDiscovery().then(function onResolve() {
//          defaultAdapter.stopLeScan(discoveryHandler).then(function onResolve() {
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
      defaultAdapter.stopDiscovery().then(function onResolve() {
//      defaultAdapter.stopLeScan(discoveryHandler).then(function onResolve() {
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
            var strValue = toHexString(characteristic.value);
            console.log(strValue);
            var valueNode = document.getElementById('characteristic')
              .getElementsByTagName('section')[0]
              .querySelectorAll('ul > li > a > p');
            if (valueNode.length > 1) {
              valueNode[1].textContent = strValue;
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
      selectedService = null;
      clearList('service-list');
      console.log('start to discover services');
      gattClient.discoverServices().then(function onResolve() {
        updateRemoteRSSI();
        for (var i in gattClient.services) {
          //              dumpGattService(gattClient.services[i]);
          addServiceToList(gattClient.services[i]);
        }
      }, function onReject(reason) {
        console.log('discover failed: reason = ' + reason);
      });

      showPage('services');
    }
  }

  function addServiceToList(service) {
    console.log('GattService uuid:' + service.uuid);
    console.log('GattService instanceid:' + service.instanceId);
    console.log('GattService isPrimary:' + service.isPrimary);
    console.log('GattService appUuid:' + service.appUuid);
    console.log('GattService serviceId:' + service.serviceId);

    var li = document.createElement('li');
    var a = document.createElement('a');
    var h = document.createElement('p');
    h.textContent = service.uuid;
    var p = document.createElement('p');
    p.textContent = 'primary: ' + service.isPrimary + ', instance id: ' + service.instanceId;
    a.appendChild(h);
    a.appendChild(p);
    a.onclick = function() {
      discoverCharacteristics(service);
    };
    li.appendChild(a);
    var list = document.getElementById('service-list');
    list.appendChild(li);
  }

  function discoverCharacteristics(service) {
    if (service) {
      selectedService = service;
    }
    selectedChar = null;
    if (selectedService) {
      clearList('char-list');
      console.log('start to discover characteristics');
      console.log(selectedService);
      for (var i in selectedService.characteristics) {
        addCharacteristicToList(selectedService.characteristics[i]);
      }
      showPage('characteristics');
    }
  }

  function addCharacteristicToList(characteristic) {
    console.log('Characteristic: broadcast(' + characteristic.properties.broadcast + '), '
      + 'read(' + characteristic.properties.read + '), '
      + 'writeNoResponse(' + characteristic.properties.writeNoResponse + '), '
      + 'write(' + characteristic.properties.write + '), '
      + 'notify(' + characteristic.properties.notify + '), '
      + 'indicate(' + characteristic.properties.indicate + '), '
      + 'signedWrite(' + characteristic.properties.signedWrite + '), '
      + 'extendedProps(' + characteristic.properties.extendedProps + '), ');
    var li = document.createElement('li');
    var a = document.createElement('a');
    var h = document.createElement('p');
    h.textContent = characteristic.uuid;
    var p = document.createElement('p');
    p.textContent =
      (characteristic.properties.read ? 'read, ' : '') +
      (characteristic.properties.write ? 'write, ' : '') +
      (characteristic.properties.writeNoResponse ? 'writeNoResponse, ' : '') +
      (characteristic.properties.notify ? 'notify, ' : '') +
      (characteristic.properties.indicate ? 'indicate, ' : '');
    if (p.textContent.length > 2) {
      p.textContent = p.textContent.substring(0, p.textContent.length - 2);
    }
    a.appendChild(h);
    a.appendChild(p);
    li.addEventListener('click', function() {
      discoverDescriptors(characteristic);
    });
    li.appendChild(a);
    var list = document.getElementById('char-list');
    list.appendChild(li);
  }

  function composeAttributes(listId, props, item) {
    clearList(listId);
    var list = document.getElementById(listId);
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

  function discoverDescriptors(characteristic) {
    if (characteristic) {
      selectedChar = characteristic;
    }
    selectedDesc = null;
    if (selectedChar) {
      clearList('desc-list');
      var props = selectedChar.properties;
      composeAttributes('char', {
        'UUID': selectedChar.uuid,
        'ServiceUUID': selectedService.uuid,
        'Device': selectedDevice.name + '(' + selectedDevice.address + ')',
        'InstanceId': selectedChar.instanceId,
        'Value': toHexString(selectedChar.value),
        'Broadcast': props.broadcast,
        'Read': props.read,
        'WriteNoResponse': props.writeNoResponse,
        'Write': props.write,
        'Notify': props.notify,
        'Indicate': props.indicate,
        'SignedWrite': props.signedWrite,
        'ExtendedProps': props.extendedProps
      }, selectedChar);
      console.log('start to discover descriptors');
      console.log(selectedChar);
      for (var i in selectedChar.descriptors) {
        addDescriptorToList(selectedChar.descriptors[i]);
      }
      showPage('characteristic');
    }
  }

  function addDescriptorToList(descriptor) {
    console.log('Descriptor uuid' + descriptor.uuid);
    console.log('Descriptor value ' + descriptor.value);
    var li = document.createElement('li');
    var a = document.createElement('a');
    var h = document.createElement('p');
    h.textContent = descriptor.uuid;
    a.appendChild(h);
    li.addEventListener('click', function() {
      showDescriptor(descriptor);
    });
    li.appendChild(a);
    var list = document.getElementById('desc-list');
    list.appendChild(li);
  }

  function showDescriptor(descriptor) {
    if (descriptor) {
      selectedDesc = descriptor;
    }
    if (selectedDesc) {
      composeAttributes('desc', {
        'UUID': selectedDesc.uuid,
        'CharacteristicUUID': selectedChar.uuid,
        'ServiceUUID': selectedService.uuid,
        'Device': selectedDevice.name + '(' + selectedDevice.address + ')',
        'Value': toHexString(selectedDesc.value)
      }, selectedDesc);
      console.log('show descriptor');
      console.log(selectedDesc);
      showPage('descriptor');
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

  rediscover.onclick = discoverServices;

  startNotiBtn.onclick = function startNotiBtnClick() {
    if (defaultAdapter && gattClient) {
      console.log('Starting notification');
      selectedChar.startNotifications().then(function onResolve() {
        console.log('start notification completed');
        startNotiBtn.style.display = 'none';
        stopNotiBtn.style.display = 'block';
      }, function onReject(reason) {
        console.log('start notification failed: reason = ' + reason);
      });
      for (var i in selectedChar.descriptors) {
        console.log('Descriptor[' + i + '] uuid:' + selectedChar.descriptors[i].uuid);
        console.log('Descriptor[' + i + '] value:' + selectedChar.descriptors[i].value);
        if (selectedChar.descriptors[i].uuid === CCCD_UUID) {
          console.log('Found CCCD!!!!');
          cccDescriptor = selectedChar.descriptors[i];
          var arrayBuffer = new ArrayBuffer(2);
          var uint8Array = new Uint8Array(arrayBuffer);
          uint8Array[0] = 0x01;
          uint8Array[1] = 0x00;
          cccDescriptor.writeValue(arrayBuffer);
        }
      }
    }
  };
  stopNotiBtn.onclick = function startNotiBtnClick() {
    if (defaultAdapter && gattClient) {
      console.log('Stopping notification');
      selectedChar.stopNotifications().then(function onResolve() {
        console.log('stop notification completed');
        startNotiBtn.style.display = 'block';
        stopNotiBtn.style.display = 'none';
      }, function onReject(reason) {
        console.log('stop notification failed: reason = ' + reason);
      });
      for (var i in selectedChar.descriptors) {
        console.log('Descriptor[' + i + '] uuid:' + selectedChar.descriptors[i].uuid);
        console.log('Descriptor[' + i + '] value:' + toHexString(selectedChar.descriptors[i].value));
        if (selectedChar.descriptors[i].uuid === CCCD_UUID) {
          console.log('Found CCCD!!!!');
          cccDescriptor = selectedChar.descriptors[i];
          var arrayBuffer = new ArrayBuffer(2);
          var uint8Array = new Uint8Array(arrayBuffer);
          uint8Array[0] = 0x00;
          uint8Array[1] = 0x00;
          cccDescriptor.writeValue(arrayBuffer);
        }
      }
    }
  };

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

  writeCharBtn.onclick = function writeChar() {
    var result = prompt('Enter Characteristic Value:');
    var array = parseHexString(result);
    console.log(array);
    selectedChar.writeValue(array);
  };
  writeDescBtn.onclick = function writeDesc() {
    var result = prompt('Enter Descriptor Value:');
    var array = parseHexString(result);
    console.log(array);
    selectedDesc.writeValue(array);
  }

}); //DOMContentLoaded
