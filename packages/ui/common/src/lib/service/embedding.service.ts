import { Injectable } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
export type EmbeddingState = {
  isEmbedded: boolean;
  hideSideNav: boolean;
  prefix: string;
  hideLogoInBuilder: boolean;
  disableNavigationInBuilder: boolean;
  hideFolders: boolean;
  hideFlowNameInBuilder: boolean;
  isCustomNavigationHandlingEnabled: boolean;
};
@Injectable({
  providedIn: 'root',
})
export class EmbeddingService {
  embeddingStateSubject: BehaviorSubject<EmbeddingState>;
  constructor() {
    this.embeddingStateSubject = new BehaviorSubject<EmbeddingState>({
      isEmbedded: false,
      hideSideNav: false,
      hideLogoInBuilder: false,
      prefix: '',
      disableNavigationInBuilder: false,
      hideFolders: false,
      hideFlowNameInBuilder: false,
      isCustomNavigationHandlingEnabled: false,
    });
  }
  getState() {
    return this.embeddingStateSubject.value;
  }
  getSkipLocationChange() {
    return this.embeddingStateSubject.value.isCustomNavigationHandlingEnabled;
  }
  setState(newState: EmbeddingState) {
    return this.embeddingStateSubject.next(newState);
  }
  getState$() {
    return this.embeddingStateSubject.asObservable();
  }
  getSkipLocationChange$() {
    return this.embeddingStateSubject
      .asObservable()
      .pipe(map((res) => res.isCustomNavigationHandlingEnabled));
  }

  getIsInEmbedding$() {
    return this.getState$().pipe(map((res) => res.isEmbedded));
  }
  getShowNavigationInBuilder$() {
    return this.getState$().pipe(map((res) => !res.disableNavigationInBuilder));
  }

  getHideLogoInBuilder$() {
    return this.getState$().pipe(map((res) => res.hideLogoInBuilder));
  }

  getHideFLowNameInBuilder$() {
    return this.getState$().pipe(map((res) => res.hideFlowNameInBuilder));
  }

  getHideFolders$() {
    return this.getState$().pipe(map((res) => res.hideFolders));
  }

  activepiecesRouteChanged(route: string) {
    window.parent.postMessage(
      {
        type: 'CLIENT_ROUTE_CHANGED',
        data: {
          route: route,
        },
      },
      '*'
    );
  }
}
