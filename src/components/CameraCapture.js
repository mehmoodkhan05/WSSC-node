import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, StatusBar } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '../contexts/AuthContext';
import {
  ROLE,
  normalizeRole,
  hasFieldLeadershipPrivileges,
} from '../lib/roles';

// Get safe area padding for status bar/notch
const getStatusBarHeight = () => {
  if (Platform.OS === 'ios') {
    return 44; // Standard iOS status bar + safe area
  } else if (Platform.OS === 'android') {
    return StatusBar.currentHeight || 24;
  }
  return 0;
};

const CameraCapture = ({ onPhotoTaken, onClose, title = 'Take Photo' }) => {
  const { profile } = useAuth();
  const role = normalizeRole(profile?.role) || ROLE.STAFF;
  const isPrivileged = hasFieldLeadershipPrivileges(role);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState(isPrivileged ? 'back' : 'front');
  const cameraRef = useRef(null);

  useEffect(() => {
    setFacing(isPrivileged ? 'back' : 'front');
  }, [isPrivileged]);

  useEffect(() => {
    if (!permission) {
      return;
    }

    if (!permission.granted && permission.canAskAgain) {
      requestPermission().catch((error) => {
        console.warn('Camera permission request failed:', error);
      });
    }
  }, [permission, requestPermission]);

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          base64: false,
        });

        // Move photo to permanent location using legacy API
        const permanentUri = `${FileSystem.documentDirectory}photo_${Date.now()}.jpg`;
        await FileSystem.moveAsync({
          from: photo.uri,
          to: permanentUri,
        });

        onPhotoTaken(permanentUri);
        onClose();
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture');
      }
    }
  };

  const toggleCameraFacing = () => {
    if (!isPrivileged) {
      return;
    }
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: getStatusBarHeight() + 8 }]}>
          <Text style={styles.title}>Camera Permission</Text>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <View style={styles.closeButtonCircle}>
              <Text style={styles.closeButtonText}>✕</Text>
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.permissionContainer}>
          <Text style={styles.messageText}>No access to camera</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: getStatusBarHeight() + 8 }]}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity 
          style={styles.closeButton} 
          onPress={onClose}
          activeOpacity={0.7}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <View style={styles.closeButtonCircle}>
            <Text style={styles.closeButtonText}>✕</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.cameraWrapper}>
        <CameraView style={styles.camera} facing={facing} ref={cameraRef} />

        <View style={styles.buttonOverlay} pointerEvents="box-none">
          <View style={styles.buttonContainer}>
            {isPrivileged ? (
              <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
                <Text style={styles.buttonText}>Flip</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.placeholder} />
            )}

            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>

            <View style={styles.placeholder} />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    padding: 4,
    marginLeft: 16,
  },
  closeButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  buttonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingBottom: 32,
  },
  flipButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    padding: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  placeholder: {
    width: 60,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  messageText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 24,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CameraCapture;
