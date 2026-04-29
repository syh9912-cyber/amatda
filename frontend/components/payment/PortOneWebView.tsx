/**
 * PortOne v2 결제 WebView 모달
 *
 * 사용:
 *   <PortOneWebView
 *     visible={true}
 *     params={{ ... }}
 *     onResult={(res) => ...}
 *     onClose={() => ...}
 *   />
 *
 * 결제 결과는 hosted checkout(`/checkout.html`)에서
 * window.ReactNativeWebView.postMessage(JSON) 으로 전달됨.
 */

import { useRef } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

const CHECKOUT_BASE = 'https://amatda-parenting.web.app/checkout.html';

export interface PortOneCheckoutParams {
  storeId: string;
  channelKey: string;
  paymentId: string;
  orderName: string;
  amount: number;
  payMethod?: 'CARD' | 'EASY_PAY' | 'TRANSFER' | 'VIRTUAL_ACCOUNT' | 'MOBILE' | 'GIFT_CERTIFICATE';
  type?: 'payment' | 'billingKey';
  customerId?: string;
  customerName?: string;
}

export interface PortOneResult {
  status: 'OK' | 'FAILED' | 'ERROR';
  type?: 'payment' | 'billingKey';
  paymentId?: string;
  billingKey?: string;
  issueId?: string;
  txId?: string;
  code?: string;
  message?: string;
}

interface Props {
  visible: boolean;
  params: PortOneCheckoutParams | null;
  onResult: (result: PortOneResult) => void;
  onClose: () => void;
}

function buildUrl(p: PortOneCheckoutParams): string {
  const qs = new URLSearchParams();
  qs.set('storeId', p.storeId);
  qs.set('channelKey', p.channelKey);
  qs.set('paymentId', p.paymentId);
  qs.set('orderName', p.orderName);
  qs.set('amount', String(p.amount));
  if (p.payMethod) qs.set('payMethod', p.payMethod);
  if (p.type) qs.set('type', p.type);
  if (p.customerId) qs.set('customerId', p.customerId);
  if (p.customerName) qs.set('customerName', p.customerName);
  return `${CHECKOUT_BASE}?${qs.toString()}`;
}

export function PortOneWebView({ visible, params, onResult, onClose }: Props) {
  const webRef = useRef<WebView>(null);

  function handleMessage(e: WebViewMessageEvent) {
    try {
      const data = JSON.parse(e.nativeEvent.data) as PortOneResult;
      onResult(data);
    } catch {
      // ignore non-JSON
    }
  }

  return (
    <Modal
      visible={visible && !!params}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>결제</Text>
        <View style={{ width: 24 }} />
      </View>
      {params ? (
        <WebView
          ref={webRef}
          source={{ uri: buildUrl(params) }}
          onMessage={handleMessage}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#FF8C5A" />
            </View>
          )}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          // 외부 결제창(카카오/네이버/토스 앱) 호출 시 새 창 안 열게
          setSupportMultipleWindows={false}
          originWhitelist={['*']}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? 36 : 12,
  },
  closeBtn: {
    fontSize: 22,
    color: '#666',
    width: 24,
    textAlign: 'left',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  loadingWrap: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
});
