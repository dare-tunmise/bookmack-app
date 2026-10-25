import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

// Where each notification goes when it is tapped.
//
// A notification that opens the app on whatever screen it was last on is a notification that
// wasted the tap. Every one of these says what it is about in `data.type`, and this is the one
// place that turns that into a destination.
const destinationFor = (data: Record<string, unknown> | undefined) => {
  switch (data?.type) {
    case 'book_request':
      return '/requests';
    case 'shelf_view':
      return '/borrowers';
    case 'overdue':
      return '/loans';
    // The nudge is about a book, and the keypad is the whole point of it — but the book sheet is
    // opened from the Library rather than routed to, so this lands there and the reading tab is
    // one tap away.
    case 'reading_nudge':
      return '/';
    default:
      return null;
  }
};

/**
 * Handles a tap on a notification, whether the app was running or was started by it.
 *
 * Mounted once, inside the signed-in part of the app: routing somebody to /requests while they
 * are on the sign-in screen would bounce them straight back.
 */
export function useNotificationTaps() {
  useEffect(() => {
    const go = (response: Notifications.NotificationResponse) => {
      const destination = destinationFor(response.notification.request.content.data);
      if (destination) router.navigate(destination as never);
    };

    // The app was already open.
    const subscription = Notifications.addNotificationResponseReceivedListener(go);

    // The app was started by the tap. The response is waiting rather than delivered, so it has to
    // be asked for — without this, a cold start lands on the Library and the tap is lost.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) go(response);
      })
      .catch(() => {});

    return () => subscription.remove();
  }, []);
}
