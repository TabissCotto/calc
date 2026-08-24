import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, PanResponder, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ViewShot, { captureRef } from 'react-native-view-shot';

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [resultText, setResultText] = useState('');

  const pointsRef = useRef([]);
  const canvasRef = useRef(null);
  const timerRef = useRef(null);

  const triggerAutoCalculate = () => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (completedPaths.length === 0 && pointsRef.current.length === 0) return;

      setIsAnalyzing(true);
      try {
        const base64Image = await captureRef(canvasRef, {
          format: 'png',
          quality: 0.8,
          result: 'base64',
        });

        console.log('Immagine catturata! Pronta per l\'API.');
        setResultText('Riconoscimento in corso...');
      } catch (error) {
        console.error('Errore durante la cattura dell\'immagine:', error);
      } finally {
        setIsAnalyzing(false);
      }
    }, 1500);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (timerRef.current) clearTimeout(timerRef.current);

        const { locationX, locationY } = evt.nativeEvent;
        const startPoint = { x: locationX, y: locationY };
        pointsRef.current = [startPoint];
        setCurrentPoints([startPoint]);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const newPoint = { x: locationX, y: locationY };
        const lastPoint = pointsRef.current[pointsRef.current.length - 1];

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
          triggerAutoCalculate();
        }
      },
    })
  ).current;

  const clearCanvas = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCompletedPaths([]);
    setCurrentPoints([]);
    pointsRef.current = [];
    setResultText('');
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

      <View style={styles.resultBar}>
        {isAnalyzing ? (
          <ActivityIndicator color="#00e676" size="small" />
        ) : (
          <Text style={styles.resultText}>{resultText || 'Scrivi qualcosa...'}</Text>
        )}
      </View>

      <ViewShot ref={canvasRef} style={styles.canvasContainer}>
        <View style={styles.svgContainer} {...panResponder.panHandlers}>
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
      </ViewShot>
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
    paddingBottom: 10,
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
  resultBar: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  resultText: {
    color: '#00e676',
    fontSize: 18,
    fontWeight: '600',
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  svgContainer: {
    flex: 1,
  },
  svg: {
    flex: 1,
  },
});