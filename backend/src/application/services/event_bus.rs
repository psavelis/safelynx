//! Event Bus Service
//!
//! Pub/sub system for broadcasting domain events to subscribers.
//! Implements the Observer pattern for loose coupling.
//!
//! Reference: https://refactoring.guru/design-patterns/observer

use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::debug;

use crate::domain::events::DomainEvent;

/// Channel capacity for event broadcasting.
const CHANNEL_CAPACITY: usize = 1024;

/// Event bus for publishing and subscribing to domain events.
#[derive(Clone)]
pub struct EventBus {
    sender: broadcast::Sender<Arc<DomainEvent>>,
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}

impl EventBus {
    /// Creates a new event bus.
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(CHANNEL_CAPACITY);
        Self { sender }
    }

    /// Publishes an event to all subscribers.
    pub fn publish(&self, event: DomainEvent) {
        let event_type = event.event_type();
        let event = Arc::new(event);

        match self.sender.send(event) {
            Ok(count) => {
                debug!("Published {} event to {} subscribers", event_type, count);
            }
            Err(_) => {
                debug!("Published {} event (no active subscribers)", event_type);
            }
        }
    }

    /// Subscribes to events.
    pub fn subscribe(&self) -> EventSubscriber {
        EventSubscriber {
            receiver: self.sender.subscribe(),
        }
    }

    /// Returns the number of active subscribers.
    pub fn subscriber_count(&self) -> usize {
        self.sender.receiver_count()
    }
}

/// A subscriber to domain events.
pub struct EventSubscriber {
    receiver: broadcast::Receiver<Arc<DomainEvent>>,
}

impl EventSubscriber {
    /// Receives the next event, waiting if necessary.
    pub fn recv(
        &mut self,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Option<Arc<DomainEvent>>> + Send + '_>>
    {
        Box::pin(async move {
            match self.receiver.recv().await {
                Ok(event) => Some(event),
                Err(broadcast::error::RecvError::Closed) => None,
                Err(broadcast::error::RecvError::Lagged(count)) => {
                    tracing::warn!("Event subscriber lagged by {} events", count);
                    // Try to get the next event without recursion
                    match self.receiver.recv().await {
                        Ok(event) => Some(event),
                        Err(_) => None,
                    }
                }
            }
        })
    }

    /// Tries to receive an event without waiting.
    pub fn try_recv(&mut self) -> Option<Arc<DomainEvent>> {
        match self.receiver.try_recv() {
            Ok(event) => Some(event),
            Err(_) => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::events::SettingsChangedEvent;
    use chrono::Utc;

    #[tokio::test]
    async fn publish_broadcasts_to_subscriber() {
        let bus = EventBus::new();
        let mut subscriber = bus.subscribe();

        let event = DomainEvent::SettingsChanged(SettingsChangedEvent {
            category: "detection".to_string(),
            timestamp: Utc::now(),
        });

        bus.publish(event);

        let received = subscriber.recv().await;
        assert!(received.is_some());
        assert_eq!(received.unwrap().event_type(), "settings_changed");
    }

    #[tokio::test]
    async fn multiple_subscribers_receive_event() {
        let bus = EventBus::new();
        let mut sub1 = bus.subscribe();
        let mut sub2 = bus.subscribe();

        let event = DomainEvent::SettingsChanged(SettingsChangedEvent {
            category: "test".to_string(),
            timestamp: Utc::now(),
        });

        bus.publish(event);

        assert!(sub1.recv().await.is_some());
        assert!(sub2.recv().await.is_some());
    }

    #[test]
    fn subscriber_count_tracks_active_subscribers() {
        let bus = EventBus::new();
        assert_eq!(bus.subscriber_count(), 0);

        let _sub1 = bus.subscribe();
        assert_eq!(bus.subscriber_count(), 1);

        let _sub2 = bus.subscribe();
        assert_eq!(bus.subscriber_count(), 2);
    }
}
