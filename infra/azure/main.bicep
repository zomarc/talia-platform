// Talia staging: single Ubuntu VM, NSG (SSH restricted + HTTP/S), public IP.
// Deploy: ./deploy-vm.sh <resource-group> [location]

@description('Linux admin username (cannot be admin, root, etc.)')
param adminUsername string = 'azureuser'

@description('SSH RSA/ED25519 public key for adminUsername')
param sshPublicKey string

@description('Restrict SSH to this CIDR, e.g. 203.0.113.10/32. Use * only for testing.')
param adminSshSourceCidr string = '*'

@description('VM name')
param vmName string = 'talia-staging'

@description('VM size (4 vCPU / 16 GiB recommended for full Supabase stack). Override if region has capacity limits (e.g. VM_SIZE=Standard_D4s_v4).')
param vmSize string = 'Standard_D4s_v4'

@description('OS disk size (GiB)')
param osDiskSizeGb int = 128

param location string = resourceGroup().location

resource nsg 'Microsoft.Network/networkSecurityGroups@2024-01-01' = {
  name: 'nsg-${vmName}'
  location: location
  properties: {
    securityRules: [
      {
        name: 'AllowSSH'
        properties: {
          priority: 1000
          access: 'Allow'
          direction: 'Inbound'
          protocol: 'Tcp'
          sourcePortRange: '*'
          sourceAddressPrefix: adminSshSourceCidr
          destinationAddressPrefix: '*'
          destinationPortRange: '22'
        }
      }
      {
        name: 'AllowHTTP'
        properties: {
          priority: 1010
          access: 'Allow'
          direction: 'Inbound'
          protocol: 'Tcp'
          sourcePortRange: '*'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '80'
        }
      }
      {
        name: 'AllowHTTPS'
        properties: {
          priority: 1020
          access: 'Allow'
          direction: 'Inbound'
          protocol: 'Tcp'
          sourcePortRange: '*'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
    ]
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: 'vnet-${vmName}'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.42.0.0/16'
      ]
    }
    subnets: [
      {
        name: 'subnet-vm'
        properties: {
          addressPrefix: '10.42.1.0/24'
          networkSecurityGroup: {
            id: nsg.id
          }
        }
      }
    ]
  }
}

resource pip 'Microsoft.Network/publicIPAddresses@2024-01-01' = {
  name: 'pip-${vmName}'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Regional'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
    dnsSettings: {
      domainNameLabel: toLower(uniqueString(resourceGroup().id, vmName))
    }
  }
}

resource nic 'Microsoft.Network/networkInterfaces@2024-01-01' = {
  name: 'nic-${vmName}'
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          subnet: {
            id: resourceId('Microsoft.Network/virtualNetworks/subnets', vnet.name, 'subnet-vm')
          }
          privateIPAllocationMethod: 'Dynamic'
          publicIPAddress: {
            id: pip.id
          }
        }
      }
    ]
  }
}

resource vm 'Microsoft.Compute/virtualMachines@2024-03-01' = {
  name: vmName
  location: location
  properties: {
    hardwareProfile: {
      vmSize: vmSize
    }
    osProfile: {
      computerName: vmName
      adminUsername: adminUsername
      linuxConfiguration: {
        disablePasswordAuthentication: true
        ssh: {
          publicKeys: [
            {
              path: '/home/${adminUsername}/.ssh/authorized_keys'
              keyData: sshPublicKey
            }
          ]
        }
      }
    }
    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: '0001-com-ubuntu-server-jammy'
        sku: '22_04-lts-gen2'
        version: 'latest'
      }
      osDisk: {
        name: '${vmName}-os'
        caching: 'ReadWrite'
        createOption: 'FromImage'
        diskSizeGB: osDiskSizeGb
        managedDisk: {
          storageAccountType: 'StandardSSD_LRS'
        }
      }
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: nic.id
          properties: {
            primary: true
          }
        }
      ]
    }
  }
}

output vmName string = vm.name
output publicIpAddress string = pip.properties.ipAddress
output fqdn string = pip.properties.dnsSettings.fqdn
output sshHint string = 'ssh ${adminUsername}@${pip.properties.ipAddress}'
