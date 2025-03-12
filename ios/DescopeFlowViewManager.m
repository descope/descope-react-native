#import <React/RCTViewManager.h>
 
@interface RCT_EXTERN_MODULE(DescopeFlowViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(deepLink, NSString)
RCT_EXPORT_VIEW_PROPERTY(flowOptions, NSDictionary)
RCT_EXPORT_VIEW_PROPERTY(onFlowReady, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onFlowSuccess, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onFlowError, RCTBubblingEventBlock)

@end
