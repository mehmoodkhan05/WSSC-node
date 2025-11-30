import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  ClipPath,
  G,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const VIEWBOX_WIDTH = 220;
const VIEWBOX_HEIGHT = 260;
const DROP_PATH =
  'M110 5C135 45 190 120 190 170C190 225 154 255 110 255C66 255 30 225 30 170C30 120 85 45 110 5Z';

const LogoFillLoader = ({ size = 200, message = 'Preparing your dashboard...' }) => {
  const fillProgress = useRef(new Animated.Value(0)).current;
  const rippleProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fillLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(fillProgress, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(fillProgress, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    );

    const rippleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(rippleProgress, {
          toValue: 1,
          duration: 2400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rippleProgress, {
          toValue: 0,
          duration: 400,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    fillLoop.start();
    rippleLoop.start();

    return () => {
      fillLoop.stop();
      rippleLoop.stop();
    };
  }, [fillProgress, rippleProgress]);

  const aspectRatio = VIEWBOX_HEIGHT / VIEWBOX_WIDTH;
  const svgHeight = size * aspectRatio;
  const dropInset = 20;
  const maxFill = VIEWBOX_HEIGHT - dropInset;
  const minFill = VIEWBOX_HEIGHT * 0.25;

  const animatedHeight = fillProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [minFill, maxFill],
  });

  const animatedY = fillProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [VIEWBOX_HEIGHT - minFill, VIEWBOX_HEIGHT - maxFill],
  });

  const rippleScale = rippleProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.35],
  });

  const rippleOpacity = rippleProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0],
  });

  return (
    <View style={styles.wrapper}>
      <View style={[styles.rippleContainer, { width: size * 1.4, height: size * 1.4 }]}>
        <Animated.View
          style={[
            styles.ripple,
            {
              opacity: rippleOpacity,
              transform: [{ scale: rippleScale }],
            },
          ]}
        />
      </View>

      <Svg width={size} height={svgHeight} viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}>
        <Defs>
          <ClipPath id="dropClip">
            <Path d={DROP_PATH} />
          </ClipPath>

          <LinearGradient id="waterGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#8de4ff" stopOpacity="0.9" />
            <Stop offset="65%" stopColor="#1a73d8" stopOpacity="0.95" />
            <Stop offset="100%" stopColor="#094c97" />
          </LinearGradient>

          <LinearGradient id="outlineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#0f6dbe" />
            <Stop offset="100%" stopColor="#02254d" />
          </LinearGradient>
        </Defs>

        <G clipPath="url(#dropClip)">
          <AnimatedRect
            x={dropInset}
            width={VIEWBOX_WIDTH - dropInset * 2}
            y={animatedY}
            height={animatedHeight}
            rx={60}
            fill="url(#waterGradient)"
          />
        </G>

        <Path d={DROP_PATH} stroke="url(#outlineGradient)" strokeWidth={5} fill="transparent" />

        <SvgText
          fill="#ffffff"
          fontSize="36"
          fontWeight="700"
          x="110"
          y="155"
          textAnchor="middle"
        >
          WSSCS
        </SvgText>

        <SvgText
          fill="#e4f0ff"
          fontSize="14"
          x="110"
          y="180"
          textAnchor="middle"
        >
          Water & Sanitation
        </SvgText>
        <SvgText
          fill="#e4f0ff"
          fontSize="14"
          x="110"
          y="198"
          textAnchor="middle"
        >
          Services Company Swat
        </SvgText>
      </Svg>

      {message ? <Text style={styles.caption}>{message}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    width: '70%',
    height: '70%',
    borderRadius: 999,
    backgroundColor: 'rgba(6, 100, 191, 0.2)',
  },
  caption: {
    marginTop: 24,
    fontSize: 16,
    fontWeight: '600',
    color: '#0f3b82',
    letterSpacing: 0.4,
  },
});

export default LogoFillLoader;

