import { AfterViewInit, Component, OnInit } from '@angular/core';
import { IgcContentPane, IgcDockManagerComponent, IgcDockManagerPaneType, IgcDocumentHost, IgcPaneHeaderConnectionEventArgs, IgcSplitPane, IgcSplitPaneOrientation } from 'ngx-flexlayout';
import { IChildDockManagerWindow, IDockManagerWindow, IMainDockManagerWindow } from './interface';
import { defineCustomElements } from 'ngx-flexlayout/loader';



defineCustomElements();
const currentWindow = window as IDockManagerWindow;

@Component({
  selector: 'app-dock-layout',
  templateUrl: './dock-layout.component.html',
  styleUrls: ['./dock-layout.component.scss']
})
export class DockLayoutComponent implements AfterViewInit {
  splitPane: IgcSplitPane = {
    type: IgcDockManagerPaneType.splitPane,
    orientation: IgcSplitPaneOrientation.horizontal,
    panes: [
      {
        type: IgcDockManagerPaneType.contentPane,
        contentId: 'content1',
        header: 'Pane 1',

      },
      {
        type: IgcDockManagerPaneType.contentPane,
        contentId: 'content2',
        header: 'Pane 2',
      }
    ]
  }
  docHost: IgcDocumentHost = {
    type: IgcDockManagerPaneType.documentHost,
    rootPane: {
      type: IgcDockManagerPaneType.splitPane,
      orientation: IgcSplitPaneOrientation.horizontal,
      panes: [
        {
          type: IgcDockManagerPaneType.tabGroupPane,
          panes: [
            {
              type: IgcDockManagerPaneType.contentPane,
              contentId: 'content1',
              header: 'Grid'
            },
            {
              type: IgcDockManagerPaneType.contentPane,
              contentId: 'content4',
              header: 'List'
            }
          ]
        }
      ]
    }
  }

  layout = {
    type: IgcDockManagerPaneType.splitPane,
    orientation: IgcSplitPaneOrientation.vertical,
    rootPane: this.splitPane
  };


  paneHeaderConnected = (event: CustomEvent<IgcPaneHeaderConnectionEventArgs>) => {
    const element = event.detail.element;
    element.dragService?.destroy();
    element.dragService = null;
    element.draggable = true;
    element.ondragstart = ev => {
      this.paneHeaderDragStart(event.detail.pane, ev);
    };
    element.ondragend = ev => {
      this.paneHeaderDragEnd(ev);
    };
  }
  paneHeaderDisconnected = (event: CustomEvent<IgcPaneHeaderConnectionEventArgs>) => {
    const element = event.detail.element;
    element.ondragstart = null;
    element.ondragend = null;
  }

  paneHeaderDragStart = async (pane: IgcContentPane, event: DragEvent) => {
    event.dataTransfer!.dropEffect = 'move';
    this.dockManager.draggedPane = pane;

    const mainWindow = this.getMainWindow();
    mainWindow.dragStartWindow = window;

    this.executeForAllWindows(this.paneDragStart, pane);
  }

  paneDragStart = (window: Window, pane: IgcContentPane) => {
    const dockManager = window.document.getElementById('dockManager') as IgcDockManagerComponent;
    if (!dockManager.draggedPane) {
      dockManager.draggedPane = pane;
    }

    this.disableContentPointerEvents(dockManager);
  }
  paneHeaderDragEnd = async (event: DragEvent) => {
    event.preventDefault();

    const mainWindow = this.getMainWindow();
    mainWindow.dragStartWindow = undefined;

    // dropped outside of the browser
    if (event.dataTransfer?.dropEffect === 'none') {
      await this.droppedOutOfWindow(event);
    }

    this.executeForAllWindows(this.paneDragEnd)
  }

  getMainWindow = (): IMainDockManagerWindow => {
    return currentWindow.isMain !== false ? currentWindow as IMainDockManagerWindow : currentWindow.mainWindow as IMainDockManagerWindow;
  }

  executeForAllWindows = (callback: (window: Window, param?: any) => void, param?: any) => {
    const mainWindow = this.getMainWindow();
    callback(mainWindow, param);
    if (mainWindow.childWindows) {
      for (const win of mainWindow.childWindows) {
        callback(win, param);
      }
    }
  }
  disableContentPointerEvents = (dockManager: IgcDockManagerComponent) => {
    for (const child of Array.from(dockManager.children)) {
      (child as HTMLElement).style.pointerEvents = 'none';
    }
  }

  droppedOutOfWindow = async (event: DragEvent) => {
    const draggedPane = this.dockManager.draggedPane as IgcContentPane;

    // if there is a single pane in the window just move the window
    if (this.dockManager.layout.rootPane.panes.length === 1 && this.dockManager.layout.rootPane.panes[0] === draggedPane) {
      window.moveTo(event.screenX, event.screenY);
      return;
    }

    await this.dockManager.removePane(draggedPane);
    this.dockManager.layout = { ...this.dockManager.layout };

    draggedPane.isPinned = true;

    const contentElement = this.dockManager.querySelector('[slot=' + draggedPane.contentId + ']');
    const rect = contentElement!.getBoundingClientRect();

    this.openChildWindow(event.screenX, event.screenY, rect.width, rect.height, (childWindow: Window) => {
      const newDocument = childWindow.document;
      const newDockManager = newDocument.getElementById('dockManager') as IgcDockManagerComponent;
      newDockManager.layout = {
        rootPane: {
          type: IgcDockManagerPaneType.splitPane,
          orientation: IgcSplitPaneOrientation.horizontal,
          panes: [
            draggedPane
          ]
        }
      };
      const adoptedNode = newDocument.adoptNode(contentElement!);
      newDockManager.appendChild(adoptedNode);
    });
  }




  dockManager: IgcDockManagerComponent;

  constructor() {
    this.dockManager = document.getElementById('dockManager') as IgcDockManagerComponent;
  }
  ngAfterViewInit(): void {
    this.dockManager = document.getElementById('dockManager') as IgcDockManagerComponent;
    this.dockManager.addEventListener('paneHeaderConnected', this.paneHeaderConnected);
    this.dockManager.addEventListener('paneHeaderDisconnected', this.paneHeaderDisconnected);
    this.dockManager.addEventListener('tabHeaderConnected', this.paneHeaderConnected);
    this.dockManager.addEventListener('tabHeaderDisconnected', this.paneHeaderDisconnected);
    this.dockManager.addEventListener('splitterResizeStart', () => this.disableContentPointerEvents(this.dockManager));
    this.dockManager.addEventListener('splitterResizeEnd', () => this.disableContentPointerEvents(this.dockManager));

    document.addEventListener('dragover', this.handleDocumentDragOver);
    document.addEventListener('drop', this.handleDocumentDrop);

  }

  openChildWindow = (x: number, y: number, width: number, height: number, onOpen: (childWindow: Window) => void) => {
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      const childWindow = mainWindow.open(
        document.location.href,
        '_blank',
        `top=${y},left=${x},width=${width},height=${height}`) as IChildDockManagerWindow;


      childWindow.isMain = false;
      childWindow.mainWindow = mainWindow;
      if (!mainWindow.childWindows) {
        mainWindow.childWindows = [];
      }
      mainWindow.childWindows.push(childWindow);
      childWindow.onload = () => {
        onOpen(childWindow);

        // for some reason onunload is fired before onload, that's why we attach it in the onload handler
        childWindow.onunload = () => {
          childWindow.mainWindow = undefined;
          const index = mainWindow.childWindows?.indexOf(childWindow);
          mainWindow.childWindows?.splice(0, 1);
        };
      }
    }
  }
  handleDocumentDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
    this.dockManager.dropPosition = {
      x: event.clientX,
      y: event.clientY
    };
  }
  handleDocumentDrop = async (event: DragEvent) => {
    const contentId = (this.dockManager.draggedPane as IgcContentPane).contentId;

    const docked = await this.dockManager.dropPane();

    if (docked) {
      const contentElement = this.dockManager.querySelector('[slot=' + contentId + ']');

      // if the content element is missing from the current dock manager it means it comes from another window
      if (!contentElement) {
        await this.droppedInAnotherWindow();
      }
    }
  }
  droppedInAnotherWindow = async () => {
    console.log("droppedInAnotherWindow");

    const mainWindow = this.getMainWindow();
    const sourceDocument = mainWindow.dragStartWindow?.document;
    const sourceDockManager = sourceDocument?.getElementById('dockManager') as IgcDockManagerComponent;

    // remove the pane from the source dock manager
    await sourceDockManager.removePane(sourceDockManager.draggedPane);
    sourceDockManager.layout = { ...sourceDockManager.layout };

    // adopt the content element from the source document into the current one
    const contentElement = sourceDockManager.querySelector('[slot=' + (sourceDockManager.draggedPane as IgcContentPane).contentId + ']');
    const adoptedNode = document.adoptNode(contentElement!);
    this.dockManager.appendChild(adoptedNode);
  }
  paneDragEnd = (window: Window) => {
    const dockManager = window.document.getElementById('dockManager') as IgcDockManagerComponent;

    if (!dockManager) {
      return;
    }

    if (dockManager.draggedPane) {
      dockManager.dropPosition = null;
      dockManager.dropPane();
    }

    this.enableContentPointerEvents(dockManager);

    // close the window if no panes were left
    if (!currentWindow.isMain && (!dockManager.layout.rootPane.panes || !dockManager.layout.rootPane.panes.length)) {
      currentWindow.close();
    }
  }
  enableContentPointerEvents = (dockManager: IgcDockManagerComponent) => {
    for (const child of Array.from(dockManager.children)) {
      (child as HTMLElement).style.pointerEvents = 'all';
    }
  }
}


