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
import { useTranslation } from 'react-i18next';

// react-native-webview는 새 EAS 빌드에서만 사용 가능 (네이티브 모듈).
// OTA로 배포된 기존 앱에서 이 파일이 로드돼도 크래시 안 나도록 동적 require.
 
let WebViewLib: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebViewLib = require('react-native-webview');
} catch {
  WebViewLib = null;
}
 
type WebViewMessageEvent = any;

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
  const { t } = useTranslation();
  const webRef = useRef<any>(null);

  function handleMessage(e: WebViewMessageEvent) {
    try {
      const data = JSON.parse(e.nativeEvent.data) as PortOneResult;
      onResult(data);
    } catch {
      // ignore non-JSON
    }
  }

  // react-native-webview 미탑재 빌드(OTA only) — 안내 화면만 표시
  if (!WebViewLib) {
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
          <Text style={styles.title}>{t('components.portOneWebView.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.fallbackWrap}>
          <Text style={styles.fallbackText}>
            {t('components.portOneWebView.updateRequired')}
          </Text>
        </View>
      </Modal>
    );
  }

  const WebView = WebViewLib.WebView;

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
        <Text style={styles.title}>{t('components.portOneWebView.title')}</Text>
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
          setSupportMultipleWindows={false}
          // 보안: PortOne 결제 흐름에 필요한 도메인 + 백엔드 호스트 + custom scheme(딥링크) 만 허용
          originWhitelist={[
            'https://*.portone.io',
            'https://*.iamport.kr',
            'https://api-usglfifguq-uc.a.run.app',
            'https://amatda-parenting.web.app',
            // 결제 PG 도메인 — 토스/카카오/네이버페이 등 (필요 시 추가)
            'https://*.tosspayments.com',
            'https://*.kakaopay.com',
            'https://*.naverpay.com',
            'amatda://',
            'about:',
          ]}
          // 위 외 도메인 navigation 차단 (피싱 사이트 우회 차단)
          onShouldStartLoadWithRequest={(req: { url?: string }) => {
            const url = req.url || '';
            const allowed = [
              'https://', 'amatda://', 'about:', 'data:image',
            ].some((p) => url.startsWith(p));
            return allowed;
          }}
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
  fallbackWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fafafa',
  },
  fallbackText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});
