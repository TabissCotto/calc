import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, PanResponder, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ViewShot, { captureRef } from 'react-native-view-shot';

// INSERISCI LA TUA API KEY DI GEMINI QUI SOTTO:
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

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
  
  // Nuovo stato per gestire l'output matematico
  const [mathResult, setMathResult] = useState(null);
  const [statusText, setStatusText] = useState('');

  const pointsRef = useRef([]);
  const completedPathsRef = useRef([]);
  const canvasRef = useRef(null);
  const timerRef = useRef(null);

  const analyzeImageWithAI = async (base64Image) => {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;
      
      const payload = {
        contents: [
          {
            parts: [
              { 
                text: "Sei un risolutore matematico. Leggi l'espressione scritta a mano in questa immagine. Restituisci ESCLUSIVAMENTE un oggetto JSON valido con due chiavi: 'latex' (l'espressione riconosciuta scritta in sintassi LaTeX) e 'result' (il risultato finale del calcolo o l'espressione semplificata). Non includere formattazione markdown o altro testo." 
              },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: base64Image
                }
              }
            ]
          }
        ]
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      // Estraiamo il testo della risposta
      let rawText = data.candidates[0].content.parts[0].text;
      
      // Puliamo eventuale markdown residuo (es. i blocchi ```json ... ```)
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const parsedJSON = JSON.parse(rawText);
      setMathResult(parsedJSON);
      setStatusText('');

    } catch (error) {
      console.error('Errore API:', error);
      setStatusText('Errore di riconoscimento o calcolo.');
    }
  };

  const triggerAutoCalculate = () => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (completedPathsRef.current.length === 0) return;

      setIsAnalyzing(true);
      setStatusText('Acquisizione immagine...');
      setMathResult(null);

      try {
        const base64Image = await captureRef(canvasRef, {
          format: 'png',
          quality: 0.8,
          result: 'base64',
        });

        setStatusText('IA al lavoro...');
        await analyzeImageWithAI(base64Image);
        
      } catch (error) {
        console.error('Errore durante la cattura:', error);
        setStatusText('Errore acquisizione.');
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
        setStatusText('');
        
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

          completedPathsRef.current.push(svgPath);
          setCompletedPaths([...completedPathsRef.current]);

          pointsRef.current = [];
          setCurrentPoints([]);

          triggerAutoCalculate();
        }
      },
    })
  ).current;

  const clearCanvas = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    completedPathsRef.current = [];
    setCompletedPaths([]);
    setCurrentPoints([]);
    pointsRef.current = [];
    setStatusText('');
    setMathResult(null);
    setIsAnalyzing(false);
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
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#00e676" size="small" style={{ marginRight: 8 }} />
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        ) : mathResult ? (
          <View style={styles.mathContainer}>
            <Text style={styles.latexText}>Letto: {mathResult.latex}</Text>
            <Text style={styles.resultText}>Risultato: {mathResult.result}</Text>
          </View>
        ) : (
          <Text style={styles.statusText}>{statusText || 'Scrivi qualcosa...'}</Text>
        )}
      </View>

      <ViewShot ref={canvasRef} style={styles.canvasContainer} options={{ format: 'png', quality: 0.8 }}>
        <View style={styles.svgContainer} collapsable={false} {...panResponder.panHandlers}>
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
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    color: '#aaaaaa',
    fontSize: 16,
    fontStyle: 'italic',
  },
  mathContainer: {
    alignItems: 'center',
  },
  latexText: {
    color: '#888888',
    fontSize: 14,
    marginBottom: 4,
  },
  resultText: {
    color: '#00e676',
    fontSize: 22,
    fontWeight: 'bold',
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