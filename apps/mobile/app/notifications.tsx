import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, ArrowLeft, Inbox } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, Radius, FontSize } from '@/constants/Colors';

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors: Colors } = useTheme();
  
  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: Colors.borderLight }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft color={Colors.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: Colors.textPrimary }]}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Empty State */}
      <View style={styles.emptyContainer}>
        <View style={[styles.iconBox, { backgroundColor: Colors.surfaceElevated, borderColor: Colors.borderLight }]}>
          <Bell color={Colors.textTertiary} size={32} />
        </View>
        <Text style={[styles.emptyTitle, { color: Colors.textPrimary }]}>No notifications yet</Text>
        <Text style={[styles.emptyDesc, { color: Colors.textTertiary }]}>
          When you receive updates about your tasks or account, they'll show up right here.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
