import { useEffect } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

const { width: SW, height: SH } = Dimensions.get('window');
const VIDEO_SOURCE = require('../assets/splash-video.mp4') as number;

interface Props {
  onEnd: () => void;
}

export default function SplashVideoPlayer({ onEnd }: Props) {
  const player = useVideoPlayer(VIDEO_SOURCE, (p) => {
    p.loop = false;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      onEnd();
    });
    return () => sub.remove();
  }, [player, onEnd]);

  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="contain"
      nativeControls={false}
      allowsFullscreen={false}
    />
  );
}

const styles = StyleSheet.create({
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SW,
    height: SH,
  },
});
