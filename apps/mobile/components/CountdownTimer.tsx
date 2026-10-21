import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius, FontSize } from '../constants/Colors';

interface CountdownTimerProps {
  deadline: string | Date;
}

export function CountdownTimer({ deadline }: CountdownTimerProps) {
  const { colors: Colors } = useTheme();
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isUrgent, setIsUrgent] = useState<boolean>(false);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const deadlineDate = new Date(deadline).getTime();
      const now = new Date().getTime();
      const difference = deadlineDate - now;

      if (difference <= 0) {
        setTimeLeft('Expired');
        setIsExpired(true);
        setIsUrgent(false);
        return;
      }

      setIsExpired(false);
      // Urgent if less than 1 hour remains
      setIsUrgent(difference < 3600000);

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      let timeString = '';
      if (days > 0) {
        timeString = `${days}d ${hours}h ${minutes}m`;
      } else {
        timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
      setTimeLeft(timeString);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  const textColor = isExpired ? Colors.textTertiary : isUrgent ? Colors.error : Colors.warning;
  const bgColor = isExpired ? Colors.surfaceElevated : isUrgent ? Colors.errorSoft : Colors.warningSoft;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Clock color={textColor} size={14} strokeWidth={2.5} />
      <Text style={[styles.text, { color: textColor }]}>
        {isExpired ? 'Deadline Passed' : `Ends in: ${timeLeft}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    gap: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: FontSize.xs + 1,
    fontWeight: '800',
  },
});
