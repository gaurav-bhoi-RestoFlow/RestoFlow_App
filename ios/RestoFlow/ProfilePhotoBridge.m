#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ProfilePhoto, NSObject)
RCT_EXTERN_METHOD(prepare:(NSString *)uri resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(remove:(NSString *)uri resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
