import { NgModule } from '@angular/core';
import { ApolloModule, Apollo } from 'apollo-angular';
import { HttpLinkModule, HttpLink } from 'apollo-angular-link-http';
import { ApolloHelperModule, ApolloHelperService } from 'inova-front-core/helpers/services/http';
import { SessionDataService } from 'inova-front-core/session';
import { NotificationsService } from 'inova-front-core/helpers/services/notifications';
import { Router } from '@angular/router';
import { onError } from 'apollo-link-error';
import { environment } from '../environments/environment';
import { MatSnackBarModule } from '@angular/material/snack-bar';


@NgModule({
  imports: [ApolloHelperModule, MatSnackBarModule],
  exports: [ApolloModule, HttpLinkModule, ApolloHelperModule],
})
export class GraphQLModule {
  constructor(
    private apollo: Apollo,
    private httpLink: HttpLink,
    private sessionService: SessionDataService,
    private notificationService: NotificationsService,
    private router: Router,
    private apolloHelper: ApolloHelperService
  ) {
    const token = this.sessionService.getToken();
    if (!token) {
      this.sessionService.localLogout(true);
    }
    this.apolloHelper.createApolloInova(
      {
        col: environment.colApi,
        it: environment.colWebApi,
        rep: environment.repApi,
      },
      token,
      this.getErrorLink()
    );
  }

  getErrorLink() {
    return onError(({ graphQLErrors }) => {
      if (graphQLErrors) {
        graphQLErrors.forEach(({ message }) => {
          if (message.includes('NOT_AUTHORIZED')) {
            this.notificationService.showError('No está autorizado');
            setTimeout(() => this.sessionService.localLogout(true), 3000);
          } else {
            this.notificationService.showError(message);
          }
        });
      }
    });
  }
}