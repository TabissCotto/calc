import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, PanResponder } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Calcola la curva di Bézier quadratica morbida tra i punti tracciati
const pointsToSvgPath = (points) => {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${(points[0].x + 0.1).toFixed(1)} ${(points[0].y + 0.1).toFixed(1)}`;
  }

  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    path += ` Q ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}, ${xc.toFixed(1)} ${yc.toFixed(1)}`;
  }

  const last = points[points.length - 1];
  path += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;

  return path;
};

export default function App() {
  const [completedPaths, setCompletedPaths] = useState([]);
  const [currentPoints, setCurrentPoints] = useState([]);
  const pointsRef = useRef([]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const startPoint = { x: locationX, y: locationY };
        pointsRef.current = [startPoint];
        setCurrentPoints([startPoint]);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const newPoint = { x: locationX, y: locationY };
        const lastPoint = pointsRef.current[pointsRef.current.length - 1];

        // Filtra micro-movimenti (rumore del touch) inferiori a 2px
        if (lastPoint) {
          const dx = newPoint.x - lastPoint.x;
          const dy = newPoint.y - lastPoint.y;
          if (Math.hypot(dx, dy) < 2) return;
        }

        pointsRef.current.push(newPoint);
        setCurrentPoints([...pointsRef.current]);
      },
      onPanResponderRelease: () => {
        if (pointsRef.current.length > 0) {
          const svgPath = pointsToSvgPath(pointsRef.current);
          setCompletedPaths((prev) => [...prev, svgPath]);
          pointsRef.current = [];
          setCurrentPoints([]);
        }
      },
    })
  ).current;

  const clearCanvas = () => {
    setCompletedPaths([]);
    setCurrentPoints([]);
    pointsRef.current = [];
  };

  const currentSvgPath = pointsToSvgPath(currentPoints);

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
          {completedPaths.map((path, index) => (
            <Path
              key={index}
              d={path}
              stroke="#ffffff"
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {currentSvgPath !== '' && (
            <Path
              d={currentSvgPath}
              stroke="#ffffff"
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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