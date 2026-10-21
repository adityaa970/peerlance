import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useRouter } from 'expo-router';
import { ArrowLeft, Send, Sparkles, User, ShieldCheck } from 'lucide-react-native';
import { Spacing, Radius, FontSize } from '../constants/Colors';
import { apiClient } from '../utils/api';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export default function SupportChatScreen() {
  const { colors: Colors } = useTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm your Peerlance Assistant. How can I help you with your campus tasks today?",
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!inputText.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      // Map messages to the format expected by the backend
      const history = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }));
      
      const res = await apiClient.post('/support', {
        messages: [...history, { role: 'user', content: userMsg.text }]
      });

      // Simulate a small delay for natural feeling
      await new Promise(resolve => setTimeout(resolve, 1000));

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: res.data.message,
        sender: 'ai',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      Alert.alert('Connection Error', 'Unable to reach support. Please try again.');
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isAi = item.sender === 'ai';
    return (
      <View style={[styles.messageRow, isAi ? styles.aiRow : styles.userRow]}>
        {isAi && (
          <View style={styles.aiAvatar}>
            <ShieldCheck color="#fff" size={14} strokeWidth={2.5} />
          </View>
        )}
        <View style={[styles.bubble, isAi ? styles.aiBubble : styles.userBubble]}>
          <Text style={[styles.messageText, isAi ? styles.aiText : styles.userText]}>
            {item.text}
          </Text>
          <Text style={[styles.timestamp, isAi ? styles.aiTimestamp : styles.userTimestamp]}>
            {`${item.timestamp.getHours()}:${item.timestamp.getMinutes().toString().padStart(2, '0')}`}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? -18 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={Colors.textPrimary} size={22} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Peerlance Assistant</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Always active</Text>
          </View>
        </View>
        <View style={styles.sparkleIcon}>
          <Sparkles color={Colors.primary} size={20} />
        </View>
      </View>

      {/* Chat List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Input Area */}
      <View style={[styles.inputOuterContainer, { paddingBottom: Math.max(insets.bottom, 12), paddingTop: 12 }]}>
        {isTyping && (
          <View style={styles.typingIndicator}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.typingText}>Assistant is thinking...</Text>
          </View>
        )}
        <View style={styles.inputPill}>
          <TextInput
            style={styles.input}
            placeholder="Ask anything about tasks..."
            placeholderTextColor={Colors.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]} 
            onPress={handleSend}
            disabled={!inputText.trim() || isTyping}
          >
            <Send color="#fff" size={18} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  sparkleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 20,
    maxWidth: '85%',
  },
  aiRow: {
    alignSelf: 'flex-start',
  },
  userRow: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 4,
  },
  bubble: {
    padding: 14,
    borderRadius: 20,
  },
  aiBubble: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  userBubble: {
    backgroundColor: Colors.primaryDark,
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  aiText: {
    color: Colors.textPrimary,
  },
  userText: {
    color: '#fff',
  },
  timestamp: {
    fontSize: 10,
    marginTop: 6,
    fontWeight: '500',
  },
  aiTimestamp: {
    color: Colors.textTertiary,
  },
  userTimestamp: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  inputOuterContainer: {
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
    paddingHorizontal: 8
  },
  typingText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 120,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    color: Colors.textPrimary,
    textAlignVertical: 'center'
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  sendButtonDisabled: {
    backgroundColor: Colors.border,
    shadowOpacity: 0
  },
});
