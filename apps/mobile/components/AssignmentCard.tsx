import { useTheme } from '../hooks/useTheme';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Clock, Star, ChevronRight } from 'lucide-react-native';
import { SubjectColors, SubjectLabels, SubjectEmojis, Radius, Spacing, FontSize } from '../constants/Colors';
import { formatINR, describeStatus, toneColors } from '../utils/format';

interface AssignmentCardProps {
  subject: string;
  pages: number;
  ratePerPage: number;
  deadline: string;
  instructions?: string;
  /** The other person on the task: the poster (for writers) or the writer (for posters). */
  posterName: string;
  posterRating: number;
  posterAvatarUrl?: string | null;
  /** Amount to feature. Defaults to pages × rate. */
  amount?: number;
  /** Caption under the amount, e.g. "You earn" or "Total". */
  amountLabel?: string;
  status?: string;
  /** Show the status pill (My Work). The open-task feed hides it. */
  showStatus?: boolean;
  onPress?: () => void;
  onLayout?: () => void;
}

export const AssignmentCard = React.forwardRef<View, AssignmentCardProps>(({
  subject,
  pages,
  ratePerPage,
  deadline,
  instructions,
  posterName,
  posterRating,
  posterAvatarUrl,
  amount,
  amountLabel = 'Total',
  status,
  showStatus = true,
  onPress,
  onLayout,
}, ref) => {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);

  const subjectColor = SubjectColors[subject] || Colors.subjectOther;
  const subjectLabel = SubjectLabels[subject]?.replace(/^\S+\s/, '') || prettify(subject);
  const emoji = SubjectEmojis[subject] || '📄';
  const value = amount ?? pages * ratePerPage;
  const { label: statusLabel, tone } = describeStatus(status);
  const statusColors = toneColors(tone, Colors);
  const needsAction = tone === 'attention';

  return (
    <TouchableOpacity
      ref={ref}
      onLayout={onLayout}
      style={[styles.card, needsAction && { borderColor: Colors.warning + '66' }]}
      activeOpacity={0.75}
      onPress={onPress}
    >
      {/* Subject + amount */}
      <View style={styles.topRow}>
        <View style={[styles.subjectTile, { backgroundColor: subjectColor + '1F' }]}>
          <Text style={styles.subjectEmoji}>{emoji}</Text>
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.subject} numberOfLines={1}>{subjectLabel}</Text>
          <Text style={styles.subline}>
            {pages} {pages === 1 ? 'page' : 'pages'} · ₹{ratePerPage}/page
          </Text>
          <View style={styles.deadlineRow}>
            <Clock color={Colors.textTertiary} size={12} strokeWidth={2.2} />
            <Text style={styles.deadlineText} numberOfLines={1}>Due {deadline}</Text>
          </View>
        </View>
        <View style={styles.amountBlock}>
          <Text style={styles.amount}>{formatINR(value)}</Text>
          <Text style={styles.amountLabel}>{amountLabel}</Text>
        </View>
      </View>

      {instructions && instructions !== 'No instructions provided.' ? (
        <Text style={styles.instructions} numberOfLines={2}>{instructions}</Text>
      ) : null}

      <View style={styles.divider} />

      {/* Person + deadline + status */}
      <View style={styles.footerRow}>
        <View style={styles.person}>
          {posterAvatarUrl ? (
            <Image source={{ uri: posterAvatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{posterName?.[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
          <Text style={styles.personName} numberOfLines={1}>{posterName}</Text>
          {posterRating > 0 && (
            <View style={styles.rating}>
              <Star color={Colors.warm} fill={Colors.warm} size={11} />
              <Text style={styles.ratingText}>{posterRating.toFixed(1)}</Text>
            </View>
          )}
        </View>

        {showStatus ? (
          <View style={[styles.statusPill, { backgroundColor: statusColors.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColors.fg }]} />
            <Text style={[styles.statusText, { color: statusColors.fg }]}>{statusLabel}</Text>
          </View>
        ) : (
          <View style={styles.chevron}>
            <ChevronRight color={Colors.primary} size={16} strokeWidth={2.5} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

function prettify(subject: string) {
  const s = String(subject || 'Other').replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const createStyles = (Colors: any) => StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  subjectTile: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subjectEmoji: {
    fontSize: 22,
  },
  titleBlock: {
    flex: 1,
  },
  subject: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  subline: {
    marginTop: 2,
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textTertiary,
  },
  amountBlock: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  amountLabel: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  instructions: {
    marginTop: Spacing.md,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  person: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
  },
  avatarFallback: {
    backgroundColor: Colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  personName: {
    flexShrink: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  deadlineText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
