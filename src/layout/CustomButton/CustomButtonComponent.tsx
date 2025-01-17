import React from 'react';
import { toast } from 'react-toastify';

import { Button } from '@digdir/design-system-react';
import { useMutation } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';

import { useAppMutations } from 'src/core/contexts/AppQueriesProvider';
import { useCurrentDataModelGuid } from 'src/features/datamodel/useBindingSchema';
import { FD } from 'src/features/formData/FormDataWrite';
import { useLaxProcessData } from 'src/features/instance/ProcessContext';
import { Lang } from 'src/features/language/Lang';
import { useNavigatePage, useNavigationParams } from 'src/hooks/useNavigatePage';
import { isSpecificClientAction } from 'src/layout/CustomButton/typeHelpers';
import { promisify } from 'src/utils/promisify';
import type { PropsFromGenericComponent } from 'src/layout';
import type { ButtonColor, ButtonVariant } from 'src/layout/Button/WrappedButton';
import type * as CBTypes from 'src/layout/CustomButton/config.generated';
import type { ClientActionHandlers } from 'src/layout/CustomButton/typeHelpers';
import type { IUserAction } from 'src/types/shared';

type Props = PropsFromGenericComponent<'CustomButton'>;

type UpdatedDataModels = {
  [dataModelGuid: string]: object;
};

type FormDataLockTools = ReturnType<typeof FD.useLocking>;

export type ActionResult = {
  updatedDataModels?: UpdatedDataModels;
  clientActions?: CBTypes.ClientAction[];
};

type UseHandleClientActions = {
  handleClientActions: (actions: CBTypes.ClientAction[]) => Promise<void>;
  handleDataModelUpdate: (lockTools: FormDataLockTools, updatedDataModels?: UpdatedDataModels) => Promise<void>;
};

/**
 * A type guard to check if the action is an action that can be run entirely on the client
 */
const isClientAction = (action: CBTypes.CustomAction): action is CBTypes.ClientAction => action.type === 'ClientAction';
/**
 * A type guard to check if the action is an action that requires a server side call
 */
const isServerAction = (action: CBTypes.CustomAction): action is CBTypes.ServerAction => action.type === 'ServerAction';

function useHandleClientActions(): UseHandleClientActions {
  const currentDataModelGuid = useCurrentDataModelGuid();
  const { navigateToPage, navigateToNextPage, navigateToPreviousPage } = useNavigatePage();

  const frontendActions: ClientActionHandlers = {
    nextPage: promisify(navigateToNextPage),
    previousPage: promisify(navigateToPreviousPage),
    navigateToPage: promisify<ClientActionHandlers['navigateToPage']>(async ({ page }) => navigateToPage(page)),
  };

  const handleClientAction = async (action: CBTypes.ClientAction) => {
    if (isSpecificClientAction('navigateToPage', action)) {
      return await frontendActions[action.id](action.metadata);
    }
    await frontendActions[action.id]();
  };

  return {
    handleClientActions: async (actions) => {
      for (const action of actions) {
        await handleClientAction(action);
      }
    },
    handleDataModelUpdate: async (lockTools, updatedDataModels) => {
      const newDataModel =
        currentDataModelGuid && updatedDataModels ? updatedDataModels[currentDataModelGuid] : undefined;
      lockTools.unlock(newDataModel);
    },
  };
}

type PerformActionMutationProps = {
  action: CBTypes.CustomAction;
  buttonId: string;
};

type UsePerformActionMutation = {
  mutation: UseMutationResult<ActionResult>;
  handleServerAction: (props: PerformActionMutationProps) => Promise<void>;
};

function useHandleServerActionMutation(lockTools: FormDataLockTools): UsePerformActionMutation {
  const { doPerformAction } = useAppMutations();
  const { partyId, instanceGuid } = useNavigationParams();
  const { handleClientActions, handleDataModelUpdate } = useHandleClientActions();

  const mutation = useMutation({
    mutationFn: async ({ action, buttonId }: PerformActionMutationProps) => {
      if (!instanceGuid || !partyId) {
        throw Error('Cannot perform action without partyId and instanceGuid');
      }
      return doPerformAction.call(partyId, instanceGuid, { action: action.id, buttonId });
    },
  });

  return {
    mutation,
    handleServerAction: async ({ action, buttonId }: PerformActionMutationProps) => {
      await lockTools.lock();
      try {
        const result = await mutation.mutateAsync({ action, buttonId });
        await handleDataModelUpdate(lockTools, result.updatedDataModels);
        if (result.clientActions) {
          await handleClientActions(result.clientActions);
        }
      } catch (error) {
        lockTools.unlock();
        if (error?.response?.data?.error?.message !== undefined) {
          toast(<Lang id={error?.response?.data?.error?.message} />, { type: 'error' });
        } else {
          toast(<Lang id='custom_actions.general_error' />, { type: 'error' });
        }
      }
    },
  };
}

export function useActionAuthorization() {
  const currentTask = useLaxProcessData()?.currentTask;
  const userActions = currentTask?.userActions;
  const actionPermissions = currentTask?.actions;
  return {
    isAuthorized: (action: IUserAction['id']) =>
      (!!actionPermissions?.[action] || userActions?.find((a) => a.id === action)?.authorized) ?? false,
  };
}

export const buttonStyles: { [style in CBTypes.CustomButtonStyle]: { color: ButtonColor; variant: ButtonVariant } } = {
  primary: { variant: 'primary', color: 'success' },
  secondary: { variant: 'secondary', color: 'first' },
};

export const CustomButtonComponent = ({ node }: Props) => {
  const { textResourceBindings, actions, id, buttonStyle = 'secondary' } = node.item;
  const lockTools = FD.useLocking(node.item.id);
  const { isAuthorized } = useActionAuthorization();
  const { handleClientActions } = useHandleClientActions();
  const { handleServerAction, mutation } = useHandleServerActionMutation(lockTools);

  const isPermittedToPerformActions = actions
    .filter((action) => action.type === 'ServerAction')
    .reduce((acc, action) => acc && isAuthorized(action.id), true);
  const disabled = !isPermittedToPerformActions || mutation.isLoading;

  const onClick = async () => {
    if (disabled) {
      return;
    }
    for (const action of actions) {
      if (isClientAction(action)) {
        await handleClientActions([action]);
      }
      if (isServerAction(action)) {
        await handleServerAction({ action, buttonId: id });
      }
    }
  };

  const { color, variant } = buttonStyles[buttonStyle];

  return (
    <Button
      id={`custom-button-${id}`}
      disabled={disabled}
      onClick={onClick}
      color={color}
      variant={variant}
      aria-busy={mutation.isLoading}
    >
      <Lang id={textResourceBindings?.title} />
    </Button>
  );
};
