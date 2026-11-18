#ifndef NEXTERM_PEER_IDENTITY_H
#define NEXTERM_PEER_IDENTITY_H

#include "control_plane_builder.h"
#include "trust.h"

Nexterm_ControlPlane_PeerIdentity_ref_t nexterm_cp_build_peer(flatcc_builder_t* b,
                                                              const nexterm_peer_t* peer);

#endif
