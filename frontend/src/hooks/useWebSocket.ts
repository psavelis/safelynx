import { useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useStore } from '@/store'
import type { WsMessage, FaceDetectedPayload } from '@/types'

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const { setWsConnected, addDetection, removeDetection } = useStore()

  const handleMessage = useCallback(
    (message: WsMessage) => {
      switch (message.type) {
        case 'Connected':
          // Connected with client ID
          break

        case 'FaceDetected': {
          const payload = message.payload as FaceDetectedPayload
          addDetection(payload)
          setTimeout(() => removeDetection(payload.camera_id), 2000)
          break
        }

        case 'NewSighting':
          toast('New face detected', {
            icon: '👤',
          })
          break

        case 'NewProfile':
          toast('New profile created', {
            icon: '➕',
          })
          break

        case 'CameraStatusChanged': {
          const statusPayload = message.payload as { status: string }
          if (statusPayload.status === 'disconnected') {
            toast.error('Camera disconnected')
          }
          break
        }

        case 'RecordingStarted':
          toast('Recording started', {
            icon: '🔴',
          })
          break

        case 'RecordingStopped':
          toast('Recording stopped', {
            icon: '⏹️',
          })
          break

        case 'StorageWarning': {
          const warningPayload = message.payload as { message: string }
          toast.error(warningPayload.message)
          break
        }

        case 'Ping':
          wsRef.current?.send(JSON.stringify({ type: 'Pong' }))
          break

        default:
          // Unknown message type
          break
      }
    },
    [addDetection, removeDetection]
  )

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setWsConnected(true)
      }

      ws.onclose = () => {
        setWsConnected(false)
        reconnectTimeoutRef.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        // Error handled silently, will reconnect
      }

      ws.onmessage = (event) => {
        try {
          const message: WsMessage = JSON.parse(event.data)
          handleMessage(message)
        } catch {
          // Failed to parse message
        }
      }
    } catch {
      reconnectTimeoutRef.current = setTimeout(connect, 3000)
    }
  }, [setWsConnected, handleMessage])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  return wsRef.current
}
