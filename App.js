import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, PanResponder } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export default function App() {
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState('');

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      setCurrentPath(`M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`);
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      setCurrentPath((prev) => `${prev} L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`);
    },
    onPanResponderRelease: () => {
      if (currentPath) {
        setPaths((prev) => [...prev, currentPath]);
        setCurrentPath('');
      }
    },
  });

  const clearCanvas = () => {
    setPaths([]);
    setCurrentPath('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Calc Canvas</Text>
        <TouchableOpacity style={styles.clearButton} onPress={clearCanvas}>
          <Text style={styles.clearText}>Cancella</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.canvasContainer} {...panResponder.panHandlers}>
        <Svg style={styles.svg}>
          {paths.map((path, index) => (
            <Path key={index} d={path} stroke="#ffffff" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {currentPath !== '' && (
            <Path d={currentPath} stroke="#ffffff" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  svg: {
    flex: 1,
  },
});
