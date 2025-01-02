#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(DescopeReactNative, NSObject)

RCT_EXTERN_METHOD(prepFlow:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startFlow:(NSString *)urlString
                 withDeepLinkURL:(NSString *)deepLinkURL
                 withBackupCustomScheme:(NSString *)backupCustomScheme
                 withCodeChallenge:(NSString *)codeChallenge
                 withResolver:(RCTPromiseResolveBlock)resolve
                 withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(resumeFlow:(NSString *)urlString
                 withIncomingURL:(NSString *)incomingURL
                 withResolver:(RCTPromiseResolveBlock)resolve
                 withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(loadItem:(NSString *)key
                 withResolver:(RCTPromiseResolveBlock)resolve
                 withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(saveItem:(NSString *)key
                 withValue:(NSString *)value
                 withResolver:(RCTPromiseResolveBlock)resolve
                 withRejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(removeItem:(NSString *)key
                 withResolver:(RCTPromiseResolveBlock)resolve
                 withRejecter:(RCTPromiseRejectBlock)reject)


+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
