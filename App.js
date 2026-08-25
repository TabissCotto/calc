import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, PanResponder, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { WebView } from 'react-native-webview';

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

const calculateBoundingBox = (points) => {
  if (!points || points.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  points.forEach((point) => {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: minX + (maxX - minX) / 2,
    centerY: minY + (maxY - minY) / 2,
  };
};

// Generatore HTML + KaTeX leggero e veloce in locale
const getKaTeXHtml = (latexFormula, resultText) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
      <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
      <style>
        body, html {
          margin: 0;
          padding: 0;
          background-color: transparent;
          color: #ffffff;
          font-family: sans-serif;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          height: 100%;
          overflow: hidden;
        }
        #formula {
          font-size: 26px;
          white-space: nowrap;
        }
        .result {
          color: #00e676;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div id="formula"></div>
      <script>
        try {
          const rawLatex = ${JSON.stringify(latexFormula + ' = ')};
          const rawResult = ${JSON.stringify(resultText)};
          const renderedLatex = katex.renderToString(rawLatex, { throwOnError: false });
          document.getElementById('formula').innerHTML = renderedLatex + '<span class="result">' + rawResult + '</span>';
        } catch(e) {
          document.getElementById('formula').innerText = ${JSON.stringify(latexFormula + ' = ' + resultText)};
        }
      </script>
    </body>
  </html>
`;

export default function App() {
  const [completedPaths, setCompletedPaths] = useState([]);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [mathResult, setMathResult] = useState(null);
  const [statusText, setStatusText] = useState('');

  const pointsRef = useRef([]);
  const completedPathsRef = useRef([]);
  const canvasRef = useRef(null);
  const timerRef = useRef(null);

  const [boundingBox, setBoundingBox] = useState(null);
  const sessionPointsRef = useRef([]);

  const analyzeImageWithAI = async (base64Image) => {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;
      
      const payload = {
        contents: [
          {
            parts: [
              { 
                text: "Sei un risolutore matematico. Leggi l'espressione scritta a mano in questa immagine. Restituisci ESCLUSIVAMENTE un oggetto JSON valido con due chiavi: 'latex' (l'espressione riconosciuta scritta in sintassi LaTeX pulita) e 'result' (il risultato finale del calcolo o l'espressione semplificata). Non includere formattazione markdown o altro testo." 
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

      let rawText = data.candidates[0].content.parts[0].text;
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const parsedJSON = JSON.parse(rawText);
      setMathResult(parsedJSON);
      setStatusText('');

    } catch (error) {
      console.error('Errore API:', error);
      setStatusText('Errore di riconoscimento.');
    }
  };

  const triggerAutoCalculate = () => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (completedPathsRef.current.length === 0) return;

      setIsAnalyzing(true);
      setStatusText('Acquisizione in corso...');
      setMathResult(null);

      try {
        const base64Image = await captureRef(canvasRef, {
          format: 'png',
          quality: 0.8,
          result: 'base64',
        });

        setStatusText('Calcolo in corso...');
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
        
        if (mathResult) {
          clearCanvas();
        }
        
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

          sessionPointsRef.current = [...sessionPointsRef.current, ...pointsRef.current];
          
          const currentBox = calculateBoundingBox(sessionPointsRef.current);
          setBoundingBox(currentBox);

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
    sessionPointsRef.current = [];
    setBoundingBox(null);
    setStatusText('');
    setMathResult(null);
    setIsAnalyzing(false);
  };

  const currentSvgPath = pointsToSvgPath(currentPoints);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Calc Canvas</Text>
        <Text style={styles.statusText}>{statusText}</Text>
        <TouchableOpacity style={styles.clearButton} onPress={clearCanvas}>
          <Text style={styles.clearText}>Cancella</Text>
        </TouchableOpacity>
      </View>

      <ViewShot ref={canvasRef} style={styles.canvasContainer} options={{ format: 'png', quality: 0.8 }}>
        <View style={styles.svgContainer} collapsable={false} {...panResponder.panHandlers}>
          
          {!mathResult && (
            <Svg style={styles.svg}>
              {completedPaths.map((path, index) => (
                <Path key={index} d={path} stroke="#ffffff" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {currentSvgPath !== '' && (
                <Path d={currentSvgPath} stroke="#ffffff" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </Svg>
          )}

          {isAnalyzing && boundingBox && !mathResult && (
            <ActivityIndicator 
              color="#00e676" 
              size="large" 
              style={[
                styles.floatingLoader,
                { left: boundingBox.centerX - 18, top: boundingBox.centerY - 18 }
              ]} 
            />
          )}

          {mathResult && boundingBox && (
            <View
              style={[
                styles.katexContainer,
                {
                  left: boundingBox.x,
                  top: boundingBox.centerY - 45,
                  width: Math.max(boundingBox.width * 1.5, 300),
                }
              ]}
              pointerEvents="none"
            >
              <WebView
                originWhitelist={['*']}
                source={{ html: getKaTeXHtml(mathResult.latex, mathResult.result) }}
                style={{ backgroundColor: 'transparent' }}
                scrollEnabled={false}
              />
            </View>
          )}

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
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusText: {
    color: '#aaaaaa',
    fontSize: 14,
    fontStyle: 'italic',
    flex: 1,
    textAlign: 'center',
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
  svgContainer: {
    flex: 1,
  },
  svg: {
    flex: 1,
  },
  floatingLoader: {
    position: 'absolute',
  },
  katexContainer: {
    position: 'absolute',
    height: 90,
  },
});