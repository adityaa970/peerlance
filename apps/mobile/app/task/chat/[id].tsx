import { useTheme } from '../../../hooks/useTheme';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Send, Phone, MoreVertical, Image as ImageIcon } from 'lucide-react-native';
import { Spacing, Radius, FontSize } from '../../../constants/Colors';
import { useUserStore } from '../../../store/userStore';
import { useAuth } from '@clerk/expo';
import { apiClient } from '../../../utils/api';
import * as ImagePicker from 'expo-image-picker';
import { uploadToCloudinary } from '../../../utils/upload';
import { ErrorState } from '../../../components/ErrorState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChatScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const {
    id
  } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useUserStore();
  const {
    getToken
  } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      const response = await apiClient.get(`/tasks/${id}/chat`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = response.data;
      if (data.success) {
        setMessages(data.messages || []);
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Could not fetch messages';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Simple poll for incoming messages
    return () => clearInterval(interval);
  }, [id]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    try {
      setSending(true);
      const token = await getToken();
      const textToSend = inputText.trim();
      setInputText(''); // optimistic clear

      const response = await apiClient.post(`/tasks/${id}/chat`, {
        text: textToSend
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = response.data;
      if (data.success) {
        setMessages(prev => [...prev, data.message]);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({
          animated: true
        }), 100);
      } else {
        setInputText(textToSend);
      }
    } catch (e: any) {
      setInputText(inputText); 
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSending(true);
        const imageUrl = await uploadToCloudinary(result.assets[0].uri);
        
        const token = await getToken();
        const response = await apiClient.post(`/tasks/${id}/chat`, {
          text: '', // or a placeholder like "[Image]"
          imageUrl: imageUrl
        }, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });

        const data = response.data;
        if (data.success) {
          setMessages(prev => [...prev, data.message]);
        }
      }
    } catch (err) {
      console.error('Image picking/upload error:', err);
    } finally {
      setSending(false);
    }
  };

  if (error && messages.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} activeOpacity={0.7}>
              <ArrowLeft color={Colors.textPrimary} size={22} strokeWidth={2} />
            </TouchableOpacity>
        </View>
        <ErrorState message={error} onRetry={fetchMessages} />
      </View>
    );
  }

  return <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? -18 : 0}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <ArrowLeft color={Colors.textPrimary} size={24} />
          </TouchableOpacity>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>U</Text>
            </View>
            <View style={styles.onlineIndicator} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Assignment Chat</Text>
            <Text style={styles.headerSubtitle}>Online</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton}>
            <MoreVertical color={Colors.textPrimary} size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        ref={scrollViewRef} 
        contentContainerStyle={styles.messagesList} 
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        <View style={styles.dateLabel}>
          <Text style={styles.dateText}>Chat started</Text>
        </View>
        
        {loading && messages.length === 0 ? <ActivityIndicator size="small" color={Colors.primary} style={{
        marginTop: 20
      }} /> : messages.map(msg => {
        const isMe = msg.senderId === user.id;
        return <View key={msg.id} style={[styles.messageWrapper, isMe ? styles.messageMe : styles.messageThem]}>
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                {msg.imageUrl && (
                  <Image source={{ uri: msg.imageUrl }} style={styles.messageImage} resizeMode="cover" />
                )}
                {msg.text ? <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextThem]}>
                  {msg.text}
                </Text> : null}
                <Text style={[styles.timeText, isMe ? styles.timeTextMe : styles.timeTextThem]}>
                  {msg.time}
                </Text>
              </View>
            </View>;
      })}
      </ScrollView>

      <View style={[styles.inputOuterContainer, { paddingBottom: Math.max(insets.bottom, 12), paddingTop: 12 }]}>
        <View style={styles.inputPill}>
          <TouchableOpacity style={styles.attachButton} onPress={handlePickImage} disabled={sending}>
            <ImageIcon color={Colors.textTertiary} size={22} />
          </TouchableOpacity>
          
          <TextInput 
            style={styles.input} 
            placeholder="Type a message..." 
            placeholderTextColor={Colors.textTertiary} 
            value={inputText} 
            onChangeText={setInputText} 
            multiline 
            maxLength={500} 
            editable={!sending} 
          />

          <TouchableOpacity style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled, sending && {
          opacity: 0.7
        }]} onPress={handleSend} disabled={!inputText.trim() || sending}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Send color="#fff" size={18} style={{
            marginLeft: 2
          }} />}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>;
}
const createStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm
  },
  headerInfo: {
    marginLeft: Spacing.xs
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '500'
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconButton: {
    padding: Spacing.sm
  },
  avatarWrapper: {
    position: 'relative',
    marginLeft: Spacing.xs
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.surface
  },
  messagesList: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl
  },
  dateLabel: {
    alignSelf: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight
  },
  dateText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '500'
  },
  messageWrapper: {
    marginBottom: Spacing.md,
    flexDirection: 'row'
  },
  messageMe: {
    justifyContent: 'flex-end'
  },
  messageThem: {
    justifyContent: 'flex-start'
  },
  bubble: {
    maxWidth: '80%',
    padding: Spacing.md,
    borderRadius: 20
  },
  bubbleMe: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4
  },
  bubbleThem: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderBottomLeftRadius: 4
  },
  messageText: {
    fontSize: FontSize.md,
    lineHeight: 22
  },
  messageTextMe: {
    color: '#fff'
  },
  messageTextThem: {
    color: Colors.textPrimary
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end'
  },
  timeTextMe: {
    color: 'rgba(255,255,255,0.7)'
  },
  timeTextThem: {
    color: Colors.textTertiary
  },
  inputOuterContainer: {
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 28,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5
  },
  attachButton: {
    padding: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    maxHeight: 120,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    paddingHorizontal: Spacing.xs,
    textAlignVertical: 'center'
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  messageImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
    marginBottom: 8
  },
  sendButtonDisabled: {
    backgroundColor: Colors.border,
    shadowOpacity: 0
  }
});