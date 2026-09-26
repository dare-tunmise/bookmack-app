import { Stack } from 'expo-router';

import { AppBar } from '@/components/app-bar';

// Screens for signed-in, verified users. The drawer holds the main sections; the add-book, edit,
// and lend screens are pushed on top of it with a back arrow.
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        header: ({ options, navigation, back }) => (
          <AppBar
            title={options.title}
            left={back ? { icon: 'arrowLeft', label: 'Go back', onPress: () => navigation.goBack() } : undefined}
          />
        )
      }}>
      <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
      <Stack.Screen name="scan" options={{ title: 'Scan a book', presentation: 'fullScreenModal' }} />
      <Stack.Screen name="scan-shelf" options={{ title: 'Scan a shelf', presentation: 'fullScreenModal' }} />
      <Stack.Screen name="cover-scan" options={{ title: 'Cover scan' }} />
      <Stack.Screen name="add-book" options={{ title: 'Add book' }} />
      <Stack.Screen name="search" options={{ title: 'Find a book' }} />
      <Stack.Screen name="book-form" options={{ title: 'Add a book' }} />
      <Stack.Screen name="edit-book" options={{ title: 'Edit book' }} />
      <Stack.Screen name="lend" options={{ title: 'Lend book' }} />
      <Stack.Screen name="borrower" options={{ title: 'Borrower' }} />
      <Stack.Screen name="borrower-form" options={{ title: 'Add borrower' }} />
      <Stack.Screen name="pick-book" options={{ title: 'Choose a book' }} />
      <Stack.Screen name="recommend" options={{ title: 'Recommend a book' }} />
      <Stack.Screen name="edit-name" options={{ title: 'Edit name' }} />
      <Stack.Screen name="change-email" options={{ title: 'Change email' }} />
      <Stack.Screen name="change-password" options={{ title: 'Change password' }} />
      <Stack.Screen name="devices" options={{ title: 'Signed-in devices' }} />
      <Stack.Screen name="delete-account" options={{ title: 'Delete account' }} />
    </Stack>
  );
}
