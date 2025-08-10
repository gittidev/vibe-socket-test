import type { App } from 'vue';
import UiCard from './parts/Card.vue';
import UiButton from './parts/Button.vue';
import UiBadge from './parts/Badge.vue';
import UiGrid from './parts/Grid.vue';
import UiTable from './parts/Table.vue';
import UiModal from './parts/Modal.vue';
import UiTabs from './parts/Tabs.vue';
import UiSpinner from './parts/Spinner.vue';

export { UiCard, UiButton, UiBadge, UiGrid, UiTable, UiModal, UiTabs, UiSpinner };

export function installUi(app: App) {
  app.component('UiCard', UiCard);
  app.component('UiButton', UiButton);
  app.component('UiBadge', UiBadge);
  app.component('UiGrid', UiGrid);
  app.component('UiTable', UiTable);
  app.component('UiModal', UiModal);
  app.component('UiTabs', UiTabs);
  app.component('UiSpinner', UiSpinner);
}
