import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { deleteProduct, deleteProducts, subscribeToProducts } from '@/features/products/repository';
import type { Product } from '@/features/products/types';
import { useAdminAuth } from '@/providers/admin-auth-provider';
import { useAppTheme } from '@/providers/theme-provider';

const LOW_STOCK_LIMIT = 5;
const formatPrice = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

type StockFilter = 'all' | 'available' | 'low' | 'out';
type SortKey = 'name' | 'price' | 'quantity';
type IconNames = Exclude<ComponentProps<typeof SymbolView>['name'], string>;
type AndroidIconName = NonNullable<IconNames['android']>;
type IOSIconName = NonNullable<IconNames['ios']>;

export default function HomeScreen() {
  const { user, loading: authLoading, signIn, signOutAdmin } = useAdminAuth();
  const theme = useAppTheme();
  const { width, height } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDescending, setSortDescending] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!user) return;
    return subscribeToProducts(
      (nextProducts) => {
        setProducts(nextProducts);
        setProductsLoading(false);
        setSelectedIds(new Set());
      },
      (error) => {
        setProductsError(error.message || 'Không tải được danh sách sản phẩm.');
        setProductsLoading(false);
      },
    );
  }, [user]);

  async function handleSignIn() {
    setSignInError('');
    if (!email.trim() || !password) {
      setSignInError('Nhập email và mật khẩu để đăng nhập.');
      return;
    }

    setSignInBusy(true);
    setProductsLoading(true);
    setProductsError('');
    try {
      await signIn(email, password);
    } catch (error) {
      const code = (error as { code?: string }).code;
      setSignInError(
        error instanceof Error && error.message === 'Tài khoản này chưa được cấp quyền quản trị.'
          ? error.message
          : code === 'auth/invalid-credential' || code === 'auth/user-not-found'
            ? 'Email hoặc mật khẩu chưa đúng.'
            : 'Đăng nhập chưa thành công. Kiểm tra tài khoản và thử lại.',
      );
    } finally {
      setSignInBusy(false);
    }
  }

  function confirmDelete(product: Product) {
    const remove = async () => {
      try {
        await deleteProduct(product.id);
        setSelectedIds((current) => {
          const next = new Set(current);
          next.delete(product.id);
          return next;
        });
      } catch {
        setProductsError('Không xóa được sản phẩm. Kiểm tra quyền Firestore rồi thử lại.');
      }
    };

    confirmAction('Xóa sản phẩm?', 'Bạn có chắc muốn xóa “' + product.name + '”?', remove);
  }

  function confirmBulkDelete() {
    const ids = Array.from(selectedIds);
    confirmAction(
      'Xóa ' + ids.length + ' sản phẩm?',
      'Thao tác này sẽ xóa các sản phẩm đã chọn khỏi kho.',
      async () => {
        try {
          await deleteProducts(ids);
          setSelectedIds(new Set());
        } catch {
          setProductsError('Không xóa được một số sản phẩm. Kiểm tra quyền Firestore rồi thử lại.');
        }
      },
    );
  }

  function confirmAction(title: string, message: string, action: () => Promise<void>) {
    if (Platform.OS === 'web') {
      if (window.confirm(title + '\n' + message)) void action();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => void action() },
    ]);
  }

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    const result = products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLocaleLowerCase('vi').includes(query);
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'available' && product.soluong > LOW_STOCK_LIMIT) ||
        (stockFilter === 'low' && product.soluong > 0 && product.soluong <= LOW_STOCK_LIMIT) ||
        (stockFilter === 'out' && product.soluong <= 0);
      return matchesSearch && matchesStock;
    });
    result.sort((a, b) => {
      const compare =
        sortKey === 'price'
          ? a.price - b.price
          : sortKey === 'quantity'
            ? a.soluong - b.soluong
            : a.name.localeCompare(b.name, 'vi');
      return sortDescending ? -compare : compare;
    });
    return result;
  }, [products, search, sortDescending, sortKey, stockFilter]);

  const desktop = width >= 900;
  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageProducts = filteredProducts.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const selectedOnPage = pageProducts.filter((product) => selectedIds.has(product.id)).length;
  const allOnPageSelected = pageProducts.length > 0 && selectedOnPage === pageProducts.length;
  const styles = createStyles(theme);
  const tableHeight = Math.min(
    46 + pageProducts.length * 78,
    Math.max(230, height - 410),
  );
  const userEmail = user?.email || 'Quản trị viên';
  const userInitial = userEmail.charAt(0).toLocaleUpperCase('vi');

  function toggleProduct(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePageSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allOnPageSelected) pageProducts.forEach((product) => next.delete(product.id));
      else pageProducts.forEach((product) => next.add(product.id));
      return next;
    });
  }

  function changeSort() {
    if (sortKey === 'name') {
      setSortKey('price');
      setSortDescending(false);
    } else if (sortKey === 'price' && !sortDescending) {
      setSortDescending(true);
    } else if (sortKey === 'price') {
      setSortKey('quantity');
      setSortDescending(false);
    } else if (!sortDescending) {
      setSortDescending(true);
    } else {
      setSortKey('name');
      setSortDescending(false);
    }
    setPage(0);
  }

  if (authLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        <ActivityIndicator color={theme.accent} size="large" />
        <Text style={styles.loadingText}>Đang kiểm tra phiên đăng nhập…</Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.page}>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.loginOuter}>
          <View style={styles.loginTop}>
            <Brand />
            <ThemeToggle />
          </View>
          <View style={styles.loginPanel}>
            <Text style={styles.eyebrow}>QUẢN TRỊ CỬA HÀNG</Text>
            <Text accessibilityRole="header" style={styles.loginTitle}>Đăng nhập</Text>
            <Text style={styles.loginDescription}>Đăng nhập bằng tài khoản admin đã tạo trong Firebase.</Text>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              onSubmitEditing={handleSignIn}
              placeholder="admin@example.com"
              placeholderTextColor={theme.muted}
              returnKeyType="next"
              style={styles.input}
              value={email}
            />
            <Text style={styles.label}>Mật khẩu</Text>
            <TextInput
              autoComplete="current-password"
              onChangeText={setPassword}
              onSubmitEditing={handleSignIn}
              placeholder="Nhập mật khẩu"
              placeholderTextColor={theme.muted}
              secureTextEntry
              style={styles.input}
              value={password}
            />
            {signInError ? <Text accessibilityRole="alert" style={styles.errorText}>{signInError}</Text> : null}
            <PrimaryButton disabled={signInBusy} onPress={handleSignIn} title="Đăng nhập quản trị" />
            {signInBusy ? <ActivityIndicator color={theme.accent} style={styles.inlineSpinner} /> : null}
          </View>
          <Text style={styles.footerNote}>Tài khoản chỉ được tạo và cấp quyền trong Firebase Console.</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <View style={[styles.content, desktop && styles.contentDesktop]}>
        <View style={styles.topBar}>
          <Brand />
          <View style={styles.topActions}>
            <View style={styles.userBlock}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{userInitial}</Text></View>
              {desktop ? <Text numberOfLines={1} style={styles.userEmail}>{userEmail}</Text> : null}
            </View>
            <ThemeToggle />
            <Pressable
              accessibilityLabel="Đăng xuất"
              accessibilityRole="button"
              onPress={() => void signOutAdmin()}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <AppIcon name="logout" iosName="rectangle.portrait.and.arrow.right" color={theme.text} />
              {desktop ? <Text style={styles.secondaryButtonText}>Đăng xuất</Text> : null}
            </Pressable>
          </View>
        </View>

        <View style={[styles.headingRow, !desktop && styles.headingMobile]}>
          <View style={styles.headingCopy}>
            <Text accessibilityRole="header" style={styles.pageTitle}>Sản phẩm</Text>
            <Text style={styles.pageDescription}>Theo dõi thông tin và số lượng tồn kho.</Text>
          </View>
          <PrimaryButton icon="add" onPress={() => router.push('/product-form')} title="Thêm sản phẩm" />
        </View>

        <View style={styles.toolbar}>
          <View style={styles.searchBox}>
            <AppIcon name="search" iosName="magnifyingglass" color={theme.muted} />
            <TextInput
              accessibilityLabel="Tìm theo tên sản phẩm"
              onChangeText={(value) => { setSearch(value); setPage(0); }}
              placeholder="Tìm theo tên sản phẩm"
              placeholderTextColor={theme.muted}
              returnKeyType="search"
              style={styles.searchInput}
              value={search}
            />
            {search ? (
              <Pressable
                accessibilityLabel="Xóa từ khóa tìm kiếm"
                accessibilityRole="button"
                onPress={() => { setSearch(''); setPage(0); }}
                style={styles.clearButton}>
                <AppIcon name="close" iosName="xmark" color={theme.muted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel="Đổi kiểu sắp xếp"
            accessibilityRole="button"
            onPress={changeSort}
            style={({ pressed }) => [styles.controlButton, pressed && styles.pressed]}>
            <AppIcon name="sort" iosName="arrow.up.arrow.down" color={theme.text} />
            <Text style={styles.controlText}>
              {sortKey === 'price' ? 'Giá' : sortKey === 'quantity' ? 'Tồn kho' : 'Tên'}{sortDescending ? ' ↓' : ' ↑'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Tồn kho</Text>
          <FilterChip active={stockFilter === 'all'} onPress={() => { setStockFilter('all'); setPage(0); }} title="Tất cả" />
          <FilterChip active={stockFilter === 'available'} onPress={() => { setStockFilter('available'); setPage(0); }} title="Còn hàng" />
          <FilterChip active={stockFilter === 'low'} onPress={() => { setStockFilter('low'); setPage(0); }} title="Sắp hết" />
          <FilterChip active={stockFilter === 'out'} onPress={() => { setStockFilter('out'); setPage(0); }} title="Hết hàng" />
        </View>

        <View style={styles.resultBar}>
          <Text style={styles.countText}>
            {filteredProducts.length === 0
              ? '0 sản phẩm'
              : 'Hiển thị ' + (currentPage * pageSize + 1) + '–' + Math.min((currentPage + 1) * pageSize, filteredProducts.length) + ' trên ' + filteredProducts.length + ' sản phẩm'}
          </Text>
          {selectedIds.size > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={confirmBulkDelete}
              style={({ pressed }) => [styles.bulkDeleteButton, pressed && styles.pressed]}>
              <AppIcon name="delete" iosName="trash" color={theme.danger} />
              <Text style={styles.bulkDeleteText}>Xóa đã chọn ({selectedIds.size})</Text>
            </Pressable>
          ) : null}
        </View>

        {productsError ? <Text accessibilityRole="alert" style={styles.errorBanner}>{productsError}</Text> : null}
        {productsLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={theme.accent} size="large" />
            <Text style={styles.emptyTitle}>Đang tải sản phẩm</Text>
          </View>
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{search || stockFilter !== 'all' ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm'}</Text>
            <Text style={styles.emptyDescription}>
              {search || stockFilter !== 'all' ? 'Thử thay đổi từ khóa hoặc bộ lọc.' : 'Thêm sản phẩm đầu tiên để bắt đầu quản lý kho.'}
            </Text>
            {!search && stockFilter === 'all' ? <PrimaryButton onPress={() => router.push('/product-form')} title="Thêm sản phẩm" /> : null}
          </View>
        ) : (
          <>
            {desktop ? (
              <View style={[styles.table, { height: tableHeight }]}>
                <View style={styles.tableHeader}>
                  <View style={styles.checkboxColumn}>
                    <Checkbox checked={allOnPageSelected} onPress={togglePageSelection} label="Chọn tất cả sản phẩm trên trang" />
                  </View>
                  <Text style={[styles.headerCell, styles.productColumn]}>SẢN PHẨM</Text>
                  <Text style={[styles.headerCell, styles.priceColumn]}>GIÁ BÁN</Text>
                  <Text style={[styles.headerCell, styles.stockColumn]}>TỒN KHO</Text>
                  <Text style={[styles.headerCell, styles.actionColumn]}>THAO TÁC</Text>
                </View>
                <FlatList
                  data={pageProducts}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <ProductTableRow
                      onDelete={() => confirmDelete(item)}
                      onEdit={() => router.push({ pathname: '/product-form', params: { id: item.id } })}
                      onSelect={() => toggleProduct(item.id)}
                      product={item}
                      selected={selectedIds.has(item.id)}
                    />
                  )}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            ) : (
              <FlatList
                contentContainerStyle={styles.mobileList}
                data={pageProducts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <ProductMobileRow
                    onDelete={() => confirmDelete(item)}
                    onEdit={() => router.push({ pathname: '/product-form', params: { id: item.id } })}
                    onSelect={() => toggleProduct(item.id)}
                    product={item}
                    selected={selectedIds.has(item.id)}
                  />
                )}
                showsVerticalScrollIndicator={false}
              />
            )}
            <View style={styles.pagination}>
              <Text style={styles.pageCount}>Trang {currentPage + 1} / {pageCount}</Text>
              <View style={styles.paginationActions}>
                <Pressable
                  accessibilityLabel="Trang trước"
                  accessibilityRole="button"
                  disabled={currentPage === 0}
                  onPress={() => setPage((value) => Math.max(0, value - 1))}
                  style={({ pressed }) => [styles.pageButton, currentPage === 0 && styles.disabledButton, pressed && styles.pressed]}>
                  <AppIcon name="chevron_left" iosName="chevron.left" color={theme.text} />
                  <Text style={styles.pageButtonText}>Trước</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Trang tiếp theo"
                  accessibilityRole="button"
                  disabled={currentPage >= pageCount - 1}
                  onPress={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                  style={({ pressed }) => [styles.pageButton, currentPage >= pageCount - 1 && styles.disabledButton, pressed && styles.pressed]}>
                  <Text style={styles.pageButtonText}>Tiếp</Text>
                  <AppIcon name="chevron_right" iosName="chevron.right" color={theme.text} />
                </Pressable>
              </View>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function Brand() {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.brandBlock}>
      <View style={styles.brandIcon}><AppIcon name="inventory_2" iosName="shippingbox.fill" color="#FFFFFF" size={18} /></View>
      <View>
        <Text style={styles.brandName}>GKDNT</Text>
        <Text style={styles.topBarCaption}>QUẢN TRỊ KHO</Text>
      </View>
    </View>
  );
}

function AppIcon({
  name,
  iosName,
  color,
  size = 18,
}: {
  name: AndroidIconName;
  iosName: IOSIconName;
  color: string;
  size?: number;
}) {
  return <SymbolView name={{ ios: iosName, android: name, web: name }} size={size} tintColor={color} />;
}

function ThemeToggle() {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const nextMode = theme.mode === 'dark' ? 'light' : 'dark';
  return (
    <Pressable
      accessibilityLabel={'Chuyển sang giao diện ' + (nextMode === 'dark' ? 'tối' : 'sáng')}
      accessibilityRole="button"
      onPress={theme.toggle}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <AppIcon
        name={nextMode === 'dark' ? 'dark_mode' : 'light_mode'}
        iosName={nextMode === 'dark' ? 'moon' : 'sun.max'}
        color={theme.text}
      />
    </Pressable>
  );
}

function PrimaryButton({ title, onPress, disabled = false, icon }: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: AndroidIconName;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, disabled && styles.disabledButton, pressed && styles.pressed]}>
      {icon ? <AppIcon name={icon} iosName="plus" color="#FFFFFF" /> : null}
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

function FilterChip({ title, active, onPress }: { title: string; active: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressed]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{title}</Text>
    </Pressable>
  );
}

function Checkbox({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.checkbox, checked && styles.checkboxChecked, pressed && styles.pressed]}>
      {checked ? <AppIcon name="check" iosName="checkmark" color="#FFFFFF" size={14} /> : null}
    </Pressable>
  );
}

function StockBadge({ quantity }: { quantity: number }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const stock = quantity <= 0 ? 'out' : quantity <= LOW_STOCK_LIMIT ? 'low' : 'available';
  const title = stock === 'out' ? 'Hết hàng' : stock === 'low' ? 'Sắp hết' : 'Còn hàng';
  return (
    <View style={[styles.stockBadge, stock === 'out' ? styles.stockOut : stock === 'low' ? styles.stockLow : styles.stockAvailable]}>
      <View style={[styles.stockDot, stock === 'out' ? styles.stockDotOut : stock === 'low' ? styles.stockDotLow : styles.stockDotAvailable]} />
      <Text style={[styles.stockBadgeText, stock === 'out' ? styles.stockTextOut : stock === 'low' ? styles.stockTextLow : styles.stockTextAvailable]}>{title}</Text>
    </View>
  );
}

function ProductTableRow({ product, selected, onSelect, onEdit, onDelete }: {
  product: Product;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return (
    <View style={[styles.tableRow, selected && styles.tableRowSelected]}>
      <View style={styles.checkboxColumn}><Checkbox checked={selected} onPress={onSelect} label={'Chọn ' + product.name} /></View>
      <View style={[styles.productColumn, styles.productCell]}>
        <ProductThumbnail product={product} />
        <View style={styles.productInfo}>
          <Text numberOfLines={1} style={styles.productName}>{product.name}</Text>
        </View>
      </View>
      <Text numberOfLines={1} style={[styles.priceColumn, styles.productPrice]}>{formatPrice.format(product.price)}</Text>
      <View style={[styles.stockColumn, styles.stockCell]}>
        <Text style={styles.stockQuantity}>{product.soluong}</Text>
        <StockBadge quantity={product.soluong} />
      </View>
      <View style={[styles.actionColumn, styles.actionCell]}>
        <RowAction label="Sửa" icon="edit" iosName="pencil" onPress={onEdit} />
        <RowAction label="Xóa" icon="delete" iosName="trash" onPress={onDelete} danger />
      </View>
    </View>
  );
}

function ProductMobileRow({ product, selected, onSelect, onEdit, onDelete }: {
  product: Product;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return (
    <View style={[styles.mobileProduct, selected && styles.tableRowSelected]}>
      <Checkbox checked={selected} onPress={onSelect} label={'Chọn ' + product.name} />
      <ProductThumbnail product={product} />
      <View style={styles.mobileProductInfo}>
        <Text numberOfLines={2} style={styles.productName}>{product.name}</Text>
        <Text style={styles.productPrice}>{formatPrice.format(product.price)}</Text>
        <View style={styles.mobileStock}>
          <Text style={styles.stockQuantity}>Tồn {product.soluong}</Text>
          <StockBadge quantity={product.soluong} />
        </View>
        <View style={styles.mobileActions}>
          <RowAction label="Sửa" icon="edit" iosName="pencil" onPress={onEdit} />
          <RowAction label="Xóa" icon="delete" iosName="trash" onPress={onDelete} danger />
        </View>
      </View>
    </View>
  );
}

function ProductThumbnail({ product }: { product: Product }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return (
    <Image
      accessibilityLabel={'Ảnh sản phẩm ' + product.name}
      cachePolicy="memory-disk"
      contentFit="cover"
      source={{ uri: product.image }}
      style={styles.productImage}
      transition={120}
    />
  );
}

function RowAction({ label, icon, iosName, onPress, danger = false }: {
  label: string;
  icon: AndroidIconName;
  iosName: IOSIconName;
  onPress: () => void;
  danger?: boolean;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return (
    <Pressable
      accessibilityLabel={label + ' sản phẩm'}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.rowAction, danger && styles.rowActionDanger, pressed && styles.pressed]}>
      <AppIcon name={icon} iosName={iosName} color={danger ? theme.danger : theme.muted} size={17} />
      <Text style={[styles.rowActionText, danger && styles.rowActionTextDanger]}>{label}</Text>
    </Pressable>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.background },
    loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: theme.background },
    loadingText: { color: theme.muted, fontSize: 15 },
    loginOuter: { flex: 1, width: '100%', maxWidth: 900, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 24 },
    loginTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
    loginPanel: { width: '100%', maxWidth: 460, alignSelf: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: 14, padding: 26, gap: 12 },
    brandBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    brandIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
    brandName: { color: theme.text, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
    topBarCaption: { color: theme.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.05, marginTop: 3 },
    eyebrow: { color: theme.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
    loginTitle: { color: theme.text, fontSize: 30, fontWeight: '700' },
    loginDescription: { color: theme.muted, fontSize: 15, lineHeight: 22, marginBottom: 8 },
    label: { color: theme.text, fontSize: 14, fontWeight: '600', marginTop: 4 },
    input: { minHeight: 48, paddingHorizontal: 13, borderRadius: 9, borderWidth: 1, borderColor: theme.border, color: theme.text, backgroundColor: theme.input, fontSize: 16 },
    primaryButton: { minHeight: 44, flexDirection: 'row', gap: 8, borderRadius: 9, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accent },
    primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    disabledButton: { opacity: 0.48 },
    pressed: { opacity: 0.76 },
    errorText: { color: theme.danger, fontSize: 14, lineHeight: 20 },
    inlineSpinner: { marginTop: 2 },
    footerNote: { alignSelf: 'center', marginTop: 22, color: theme.muted, fontSize: 13, textAlign: 'center' },
    content: { flex: 1, width: '100%', paddingHorizontal: 16, paddingBottom: 12 },
    contentDesktop: { width: '100%', maxWidth: 1560, alignSelf: 'center', paddingHorizontal: 36 },
    topBar: { minHeight: 68, borderBottomWidth: 1, borderBottomColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    userBlock: { flexDirection: 'row', alignItems: 'center', gap: 9, marginRight: 8, maxWidth: 210 },
    avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: theme.accent, fontSize: 14, fontWeight: '700' },
    userEmail: { color: theme.text, fontSize: 13, fontWeight: '600', maxWidth: 160 },
    iconButton: { minWidth: 42, minHeight: 42, borderRadius: 9, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
    secondaryButtonText: { color: theme.text, fontSize: 13, fontWeight: '600' },
    headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingTop: 28, paddingBottom: 22 },
    headingMobile: { alignItems: 'flex-start' },
    headingCopy: { flex: 1, gap: 5 },
    pageTitle: { color: theme.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
    pageDescription: { color: theme.muted, fontSize: 14, lineHeight: 20 },
    toolbar: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
    searchBox: { flex: 1, minWidth: 0, height: 44, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: theme.border, borderRadius: 9, paddingHorizontal: 11, backgroundColor: theme.surface },
    searchInput: { flex: 1, minWidth: 0, height: '100%', padding: 0, color: theme.text, fontSize: 14 },
    clearButton: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
    controlButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 9, backgroundColor: theme.surface },
    controlText: { color: theme.text, fontSize: 13, fontWeight: '600' },
    filterRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginBottom: 17 },
    filterLabel: { color: theme.muted, fontSize: 12, fontWeight: '600', marginRight: 2 },
    filterChip: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 7, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: 'transparent' },
    filterChipActive: { backgroundColor: theme.accentSoft, borderColor: theme.accentBorder },
    filterChipText: { color: theme.muted, fontSize: 12, fontWeight: '600' },
    filterChipTextActive: { color: theme.accent, fontWeight: '700' },
    resultBar: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    countText: { color: theme.muted, fontSize: 12, fontWeight: '500' },
    bulkDeleteButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9 },
    bulkDeleteText: { color: theme.danger, fontSize: 12, fontWeight: '700' },
    errorBanner: { color: theme.danger, backgroundColor: theme.dangerSoft, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 14 },
    emptyState: { minHeight: 260, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
    emptyTitle: { color: theme.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
    emptyDescription: { color: theme.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 380 },
    table: { minHeight: 0, overflow: 'hidden', borderRadius: 11, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
    tableHeader: { minHeight: 46, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.surfaceMuted },
    headerCell: { color: theme.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
    checkboxColumn: { width: 42, alignItems: 'flex-start', justifyContent: 'center' },
    productColumn: { flex: 1, minWidth: 180 },
    priceColumn: { width: 155 },
    stockColumn: { width: 180 },
    actionColumn: { width: 155 },
    tableRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
    tableRowSelected: { backgroundColor: theme.selected },
    productCell: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
    productImage: { width: 52, height: 52, borderRadius: 8, backgroundColor: theme.surfaceMuted },
    productInfo: { flex: 1, minWidth: 0, gap: 4 },
    productName: { color: theme.text, fontSize: 14, fontWeight: '600', lineHeight: 19 },
    productPrice: { color: theme.text, fontSize: 13, fontWeight: '700' },
    stockCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stockQuantity: { color: theme.text, fontSize: 13, fontWeight: '600' },
    stockBadge: { minHeight: 25, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, borderRadius: 6 },
    stockAvailable: { backgroundColor: theme.successSoft },
    stockLow: { backgroundColor: theme.warningSoft },
    stockOut: { backgroundColor: theme.dangerSoft },
    stockDot: { width: 6, height: 6, borderRadius: 3 },
    stockDotAvailable: { backgroundColor: theme.success },
    stockDotLow: { backgroundColor: theme.warning },
    stockDotOut: { backgroundColor: theme.danger },
    stockBadgeText: { fontSize: 10, fontWeight: '700' },
    stockTextAvailable: { color: theme.successText },
    stockTextLow: { color: theme.warningText },
    stockTextOut: { color: theme.danger },
    actionCell: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    rowAction: { minWidth: 54, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 7, paddingHorizontal: 6 },
    rowActionDanger: { backgroundColor: 'transparent' },
    rowActionText: { color: theme.muted, fontSize: 11, fontWeight: '600' },
    rowActionTextDanger: { color: theme.danger },
    checkbox: { width: 19, height: 19, borderRadius: 5, borderWidth: 1, borderColor: theme.checkboxBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface },
    checkboxChecked: { backgroundColor: theme.accent, borderColor: theme.accent },
    mobileList: { gap: 9, paddingBottom: 10 },
    mobileProduct: { minHeight: 136, flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
    mobileProductInfo: { flex: 1, minWidth: 0, gap: 4 },
    mobileStock: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 1 },
    mobileActions: { flexDirection: 'row', gap: 4, marginTop: 2, alignSelf: 'flex-end' },
    pagination: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: theme.border, marginTop: 4 },
    pageCount: { color: theme.muted, fontSize: 12 },
    paginationActions: { flexDirection: 'row', gap: 7 },
    pageButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
    pageButtonText: { color: theme.text, fontSize: 12, fontWeight: '600' },
  });
}
