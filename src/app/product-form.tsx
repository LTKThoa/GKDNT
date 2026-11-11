import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { createProduct, getProduct, updateProduct } from '@/features/products/repository';
import type { ProductFields } from '@/features/products/types';
import { uploadProductImage } from '@/lib/cloudinary';
import { useAdminAuth } from '@/providers/admin-auth-provider';
import { useAppTheme } from '@/providers/theme-provider';

export default function ProductFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = typeof id === 'string' && id.length > 0;
  const { user, loading: authLoading } = useAdminAuth();
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/');
      return;
    }
    if (!editing || !id) return;

    let active = true;
    getProduct(id)
      .then((product) => {
        if (!active) return;
        if (!product) {
          setError('Không tìm thấy sản phẩm cần sửa.');
          return;
        }
        setName(product.name);
        setPrice(String(product.price));
        setQuantity(String(product.soluong));
        setImageUrl(product.image);
      })
      .catch(() => {
        if (active) setError('Không tải được sản phẩm. Kiểm tra quyền Firestore rồi thử lại.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, editing, id, user]);

  async function chooseImage() {
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });

    if (!result.canceled) {
      setImageAsset(result.assets[0]);
    }
  }

  async function saveProduct() {
    setError('');
    const normalizedName = name.trim();
    const priceNumber = Number(price.replace(',', '.'));
    const quantityNumber = Number(quantity);

    if (!normalizedName) {
      setError('Nhập tên sản phẩm.');
      return;
    }
    if (!price.trim() || !Number.isFinite(priceNumber) || priceNumber < 0) {
      setError('Giá phải là số không âm.');
      return;
    }
    if (!/^\d+$/.test(quantity.trim()) || quantityNumber < 0) {
      setError('Số lượng phải là số nguyên không âm.');
      return;
    }
    if (!imageAsset && !imageUrl) {
      setError('Chọn ảnh sản phẩm trước khi lưu.');
      return;
    }

    setSaving(true);
    try {
      const uploadedImage = imageAsset ? await uploadProductImage(imageAsset) : imageUrl;
      const productFields: ProductFields = {
        name: normalizedName,
        price: priceNumber,
        soluong: quantityNumber,
        image: uploadedImage,
      };

      if (editing && id) {
        await updateProduct(id, productFields);
      } else {
        await createProduct(productFields);
      }
      router.replace('/');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Không lưu được sản phẩm. Kiểm tra kết nối rồi thử lại.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !user) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        <ActivityIndicator color={theme.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        <ActivityIndicator color={theme.accent} size="large" />
        <Text style={styles.mutedText}>Đang tải thông tin sản phẩm…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backButtonText}>‹  Quay lại</Text>
            </Pressable>
            <Text style={styles.topBarLabel}>QUẢN TRỊ SẢN PHẨM</Text>
          </View>

          <View style={styles.formWrap}>
            <Text style={styles.eyebrow}>{editing ? 'CẬP NHẬT DANH MỤC' : 'THÊM VÀO DANH MỤC'}</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
            </Text>
            <Text style={styles.description}>Nhập đủ thông tin và chọn ảnh sản phẩm.</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Tên sản phẩm</Text>
              <TextInput
                autoCapitalize="sentences"
                onChangeText={setName}
                placeholder="Ví dụ: Áo sơ mi trắng"
                placeholderTextColor={theme.muted}
                style={styles.input}
                value={name}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Giá (VND)</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setPrice}
                placeholder="Ví dụ: 250000"
                placeholderTextColor={theme.muted}
                style={styles.input}
                value={price}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Số lượng</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setQuantity}
                placeholder="Ví dụ: 12"
                placeholderTextColor={theme.muted}
                style={styles.input}
                value={quantity}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Ảnh sản phẩm</Text>
              <Pressable accessibilityRole="button" onPress={() => void chooseImage()} style={styles.imagePicker}>
                {imageAsset || imageUrl ? (
                  <Image
                    source={{ uri: imageAsset?.uri ?? imageUrl }}
                    style={styles.previewImage}
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.imagePlaceholderTitle}>Chọn ảnh từ thiết bị</Text>
                    <Text style={styles.mutedText}>Ảnh sẽ được tải lên Cloudinary khi lưu.</Text>
                  </View>
                )}
                <View style={styles.imagePickerButton}>
                  <Text style={styles.imagePickerButtonText}>{imageAsset || imageUrl ? 'Đổi ảnh' : 'Chọn ảnh'}</Text>
                </View>
              </Pressable>
            </View>

            {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void saveProduct()}
              style={({ pressed }) => [styles.saveButton, saving && styles.disabledButton, pressed && styles.pressed]}>
              {saving ? (
                <View style={styles.savingRow}>
                  <ActivityIndicator color={theme.mode === 'dark' ? '#10201D' : '#FFFFFF'} />
                  <Text style={styles.saveButtonText}>{imageAsset ? 'Đang tải ảnh và lưu…' : 'Đang lưu…'}</Text>
                </View>
              ) : (
                <Text style={styles.saveButtonText}>{editing ? 'Lưu thay đổi' : 'Lưu sản phẩm'}</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.background },
    loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: theme.background },
    scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 32 },
    topBar: { width: '100%', maxWidth: 900, minHeight: 64, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: theme.border },
    backButton: { minHeight: 42, justifyContent: 'center', paddingRight: 12 },
    backButtonText: { color: theme.accent, fontSize: 15, fontWeight: '700' },
    topBarLabel: { color: theme.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    formWrap: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingTop: 28, gap: 13 },
    eyebrow: { color: theme.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.1 },
    title: { color: theme.text, fontSize: 28, fontWeight: '700' },
    description: { color: theme.muted, fontSize: 15, lineHeight: 21, marginBottom: 4 },
    fieldGroup: { gap: 7, marginTop: 5 },
    label: { color: theme.text, fontSize: 14, fontWeight: '600' },
    input: { minHeight: 48, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: theme.border, color: theme.text, backgroundColor: theme.input, fontSize: 16 },
    imagePicker: { minHeight: 154, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.border, borderRadius: 12, backgroundColor: theme.surface },
    previewImage: { width: 104, height: 128, borderRadius: 8, backgroundColor: theme.surfaceMuted },
    imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
    imagePlaceholderTitle: { color: theme.text, fontSize: 14, fontWeight: '600' },
    mutedText: { color: theme.muted, fontSize: 13, textAlign: 'center' },
    imagePickerButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 9, backgroundColor: theme.accentSoft },
    imagePickerButtonText: { color: theme.accent, fontSize: 13, fontWeight: '700' },
    errorText: { color: theme.danger, fontSize: 14, lineHeight: 20 },
    saveButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingHorizontal: 18, borderRadius: 10, backgroundColor: theme.accent },
    saveButtonText: { color: theme.mode === 'dark' ? '#10201D' : '#FFFFFF', fontSize: 15, fontWeight: '700' },
    savingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    disabledButton: { opacity: 0.6 },
    pressed: { opacity: 0.78 },
  });
}
